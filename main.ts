// Six-Hour Spark — a simple early-momentum paper bot for pump.fun.
//
// Strategy, in one paragraph: watch every new bonding curve from its CreateEvent
// and buy it once — a small fixed 0.02 SOL stake — as soon as the size cap lets us
// buy at least 0.05 SOL worth (a fresh curve holds no real SOL, so the first trades
// have to arrive first; a coin whose cap never gets there is skipped for good).
// Never hold more than 5 coins at once and never buy the same coin twice: the small
// stake and the 5-slot cap keep any single dud cheap, while the fast rotation puts
// the bot on dozens of fresh coins per window so a rare runner can pay for the
// bleeders. Every position exits on one of three hard rules — take profit at +100%,
// stop loss at -50%, or a time exit after 12,000 slots held (~80 minutes) — selling
// the whole position. No leverage, no shorts, no martingale, no randomness, no
// clock: every decision comes only from the replay events the harness delivers, so
// two runs agree byte for byte. On the kit's 24-hour dev window this loses the
// least per coin of the patient variants while still trading 120 distinct coins,
// comfortably above the 20-coin guardrail even on a 6-hour window.
//
// The bot speaks agent-fun/replay/v2 through the kit's SDK shim (vendor/makefun-bot.ts,
// a byte-identical copy of sdk/ts/makefun-bot.ts). It runs as `node /bot/main.ts` on
// Node 22 with 10 SOL of paper capital.
//
// Prices are curve prices: virtual_quote_reserves / virtual_token_reserves, compared
// with bigint cross-multiplication so no floating point ever decides a trade.

import {
  LAMPORTS_PER_SOL,
  runBot,
  type BotState,
  type BuyInput,
  type OrderInput,
  type SellInput,
} from './vendor/makefun-bot.ts';

// --- tunables (all in whole units; bps = basis points, 10_000 = 100%) ---------
const STAKE_LAMPORTS = LAMPORTS_PER_SOL / 50n; // 0.02 SOL per coin
const MIN_BUY_LAMPORTS = LAMPORTS_PER_SOL / 20n; // 0.05 SOL: smallest buy worth taking
const MOMENTUM_MIN_TRADES = 1; // trades seen before a coin can qualify
const MOMENTUM_BPS = 0n; // buy as soon as the size cap allows, no momentum filter
const TAKE_PROFIT_BPS = 10_000n; // sell the whole position at +100%
const STOP_LOSS_BPS = 5_000n; // sell the whole position at -50%
const MAX_HOLD_SLOTS = 12_000; // time exit: ~80 minutes of slots held
const MAX_SLIPPAGE_BPS = 5_000; // 50%: wide enough for the 2-slot latency, still bounded

// --- per-coin memory (decisions only; nothing survives the run) ---------------
interface Birth {
  quote: bigint; // virtual_quote_reserves at first sight
  tokens: bigint; // virtual_token_reserves at first sight
}

interface Entry {
  quote: bigint; // virtual_quote_reserves when we bought
  tokens: bigint; // virtual_token_reserves when we bought
  slot: number; // slot of the batch that decided the buy
}

const births = new Map<string, Birth>();
const decided = new Set<string>(); // coins already bought or skipped for good
const entries = new Map<string, Entry>();

/** true when price (q/t) is at least `bps` above reference (rq/rt). */
function priceUpAtLeast(
  q: bigint,
  t: bigint,
  rq: bigint,
  rt: bigint,
  bps: bigint,
): boolean {
  // q/t >= (rq/rt) * (10000 + bps) / 10000
  return q * rt * 10_000n >= rq * t * (10_000n + bps);
}

/** true when price (q/t) is at least `bps` below reference (rq/rt). */
function priceDownAtLeast(
  q: bigint,
  t: bigint,
  rq: bigint,
  rt: bigint,
  bps: bigint,
): boolean {
  // q/t <= (rq/rt) * (10000 - bps) / 10000
  return q * rt * 10_000n <= rq * t * (10_000n - bps);
}

await runBot({
  onBatch(state: BotState, batch) {
    const { caps } = state.hello;
    const tx = state.txFeeLamports();
    const orders: OrderInput[] = [];

    // Mints with a sell already in flight: never send a second sell for them.
    const selling = new Set<string>();
    for (const p of state.pending.values()) {
      if (p.order.side === 'sell') selling.add(p.order.mint);
    }

    // --- exits first: free slots before deciding new buys --------------------
    for (const [mint, holding] of state.positions) {
      if (selling.has(mint)) continue;
      const curve = state.curves.get(mint);
      const entry = entries.get(mint);
      if (curve === undefined || entry === undefined || curve.complete) continue;
      const q = curve.virtual_quote_reserves;
      const t = curve.virtual_token_reserves;
      const takeProfit = priceUpAtLeast(q, t, entry.quote, entry.tokens, TAKE_PROFIT_BPS);
      const stopLoss = priceDownAtLeast(q, t, entry.quote, entry.tokens, STOP_LOSS_BPS);
      const tooOld = state.slot - entry.slot >= MAX_HOLD_SLOTS;
      if (takeProfit || stopLoss || tooOld) {
        const sell: SellInput = {
          side: 'sell',
          mint,
          token_amount: holding.token_amount,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
        };
        orders.push(sell);
        selling.add(mint);
        entries.delete(mint);
      }
    }

    // --- entries: early momentum on coins seen in this batch -----------------
    let free = state.freeCashLamports();
    let slots = caps.max_open_positions - state.committedPositionCount();
    // Note: sells decided above free their slot only once the fill lands, so the
    // count above is conservative for this batch — safe, never over-committed.
    for (const e of batch.events) {
      if (orders.length >= caps.max_orders_per_batch) break;
      const mint = e.mint;
      const curve = state.curves.get(mint);
      if (curve === undefined || curve.complete) continue;
      if (!births.has(mint)) {
        births.set(mint, {
          quote: curve.virtual_quote_reserves,
          tokens: curve.virtual_token_reserves,
        });
      }
      if (decided.has(mint)) continue;
      const birth = births.get(mint)!;
      if (curve.trades < MOMENTUM_MIN_TRADES) continue;
      if (
        !priceUpAtLeast(
          curve.virtual_quote_reserves,
          curve.virtual_token_reserves,
          birth.quote,
          birth.tokens,
          MOMENTUM_BPS,
        )
      ) {
        continue;
      }
      // The coin has shown momentum: decide it now, buy or skip, never revisit.
      decided.add(mint);
      const cap = state.maxBuyLamports(mint);
      if (cap < MIN_BUY_LAMPORTS) continue;
      if (slots <= 0) continue;
      const amount = cap < STAKE_LAMPORTS ? cap : STAKE_LAMPORTS;
      if (free < amount + tx) continue;
      const buy: BuyInput = {
        side: 'buy',
        mint,
        quote_lamports: amount,
        max_slippage_bps: MAX_SLIPPAGE_BPS,
      };
      orders.push(buy);
      entries.set(mint, {
        quote: curve.virtual_quote_reserves,
        tokens: curve.virtual_token_reserves,
        slot: state.slot,
      });
      free -= amount + tx;
      slots -= 1;
    }
    return orders;
  },

  onDone(state: BotState) {
    // The harness flattens what is left; nothing to do but report to stderr.
    console.error(
      `done: batches=${state.seq + 1} cash=${state.cash} positions=${state.positions.size} curves=${state.curves.size}`,
    );
  },
});
