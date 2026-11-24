# Six-Hour Spark

[![make.fun](https://make.fun/badge/u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b.svg)](https://make.fun/bounty/u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b)
[![Rank](https://make.fun/badge/u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b/dwi085/makefun-pump-fun-any-bot-20261124/rank.svg)](https://make.fun/bounty/u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b)
[![Reward](https://make.fun/badge/u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b/dwi085/makefun-pump-fun-any-bot-20261124/reward.svg)](https://make.fun/bounty/u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b)

A simple early-momentum paper-trading bot for the [Pump.fun Paper Sprint: Any Bot Can Win](https://make.fun/bounty/u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b) bounty on [make.fun](https://make.fun).

## Strategy

Watch every new pump.fun bonding curve from its `CreateEvent`, remember the price it is born at, and buy it once — a fixed 0.25 SOL stake — as soon as it shows real early momentum (at least 4 trades and a price at least 12% above its birth price, with enough real SOL reserve that the size cap allows a buy of at least 0.05 SOL). Never hold more than 5 coins at once, never buy the same coin twice, and never chase a coin that never shows momentum.

Every position exits on one of three hard rules: take profit at +40%, stop loss at −25%, or a time exit after 15,000 slots held (~100 minutes). No leverage, no shorts, no martingale, no randomness, no clock — every decision comes only from the replay events the harness delivers, so two runs agree byte for byte.

## How it runs

`main.ts` (Node 22) speaks the `agent-fun/replay/v2` protocol through the kit's SDK shim vendored at `vendor/makefun-bot.ts`. The house replay runs it over 6 hours of recorded pump.fun activity with 10 SOL of paper capital; the highest net PnL wins.

## Files

- `main.ts` — the bot (entrypoint)
- `vendor/makefun-bot.ts` — the kit's SDK shim, byte-identical copy of `sdk/ts/makefun-bot.ts`
- `LICENSE` — MIT
