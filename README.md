# Six-Hour Spark

[![make.fun](https://make.fun/badge/u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b.svg)](https://make.fun/bounty/u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b)
[![Rank](https://make.fun/badge/u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b/dwi085/makefun-pump-fun-any-bot-20261124/rank.svg)](https://make.fun/bounty/u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b)
[![Reward](https://make.fun/badge/u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b/dwi085/makefun-pump-fun-any-bot-20261124/reward.svg)](https://make.fun/bounty/u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b)

A simple early-momentum paper-trading bot for the [Pump.fun Paper Sprint: Any Bot Can Win](https://make.fun/bounty/u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b) bounty on [make.fun](https://make.fun).

## Strategy

Watch every new pump.fun bonding curve from its `CreateEvent` and buy it once — a small fixed 0.02 SOL stake — as soon as the size cap lets us buy at least 0.05 SOL worth (a fresh curve holds no real SOL, so the first trades have to arrive first; a coin whose cap never gets there is skipped for good). Never hold more than 5 coins at once, never buy the same coin twice: the small stake and the 5-slot cap keep any single dud cheap, while the fast rotation puts the bot on dozens of fresh coins per window so a rare runner can pay for the bleeders.

Every position exits on one of three hard rules: take profit at +100%, stop loss at −50%, or a time exit after 12,000 slots held (~80 minutes). No leverage, no shorts, no martingale, no randomness, no clock — every decision comes only from the replay events the harness delivers, so two runs agree byte for byte.

Local backtest (kit's own `grade-local`, `--driver process`, 24-hour dev window): starting balance 10 SOL, final balance 9.4398 SOL, net PnL −0.5602 SOL, 235 fills over 120 coins, 120 round trips, win rate 14.2%, max drawdown 0.0584. The dev window is a 24-hour sample; the house final replay is 6 hours of fresh data recorded after entries close, so its numbers will differ.

## How it runs

`main.ts` (Node 22) speaks the `agent-fun/replay/v2` protocol through the kit's SDK shim vendored at `vendor/makefun-bot.ts`. The house replay runs it over 6 hours of recorded pump.fun activity with 10 SOL of paper capital; the highest net PnL wins.

## Files

- `main.ts` — the bot (entrypoint)
- `vendor/makefun-bot.ts` — the kit's SDK shim, byte-identical copy of `sdk/ts/makefun-bot.ts`
- `LICENSE` — MIT
