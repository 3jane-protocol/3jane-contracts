# 3Jane

3Jane is a crypto-native derivatives protocol leveraging restaking and cash-and-carry to unlock a novel derivatives yield source. 3Jane enables the collateralization of shared security of any Proof-of-Stake system in financial derivatives contracts, allowing users to generate real ETH / BTC yield on EigenLayer and Babylon.

Users can wrap natively restaked ETH, restaked LST's, eETH, ezETH, sUSDe, and sDAI on 3Jane & earn additional options premiums yield. Under the hood, 3Jane vaults sell deep Out-of-the-Money options & accrue premiums to wrapped deposits.

3Jane contracts are a fork of Ribbon Finance V2 vaults with enhancements.

## Getting Started

First, install the dependencies with yarn:

```bash
yarn install
```

Next, we need to populate the .env file with these values.\
Copy the .env.example -> .env and fill out the value.\
Reach out to the team if you need help on these variables. The `TEST_URI` needs to be an archive node.

```bash
TEST_URI=
MAINNET_URI=
KOVAN_URI=
ETHERSCAN_API_KEY=
KOVAN_MNEMONIC=
MAINNET_MNEMONIC=
AVAX_URI=https://api.avax.network/ext/bc/C/rpc
FUJI_URI=https://mainnet.infura.io/v3/0bccea5795074895bdb92c62c5c3afba
AVAX_MNEMONIC=
FUJI_MNEMONIC=
```

Finally, we can run the tests:

```bash
# Run all the tests
yarn test

# Run specific test that matches the pattern -g
yarn run ts-mocha test/RibbonThetaYearnVault.ts --timeout 500000 -g 'rollToNextOption'
```

## Deployment

Ribbon v2 uses [hardhat-deploy](https://github.com/wighawag/hardhat-deploy) to manage contract deployments to the blockchain.

To deploy all the contracts to Kovan, do

```
yarn deploy --network kovan
```

The deployment info is stored on disk and committed into Git. Next, we have to export out the deployed addresses in a parseable format for the frontend to use (JSON).

```
yarn export-deployments
```

Finally, we can verify the contracts on Etherscan:

```
yarn etherscan-verify --network kovan
```

## Testing

Will run all tests on Ethereum mainnet and a subset of tests on Avax

```
yarn test
```

Runs Ethereum mainnet

```
yarn test:eth
```

Runs Avax testnet

```
yarn test:avax
```
