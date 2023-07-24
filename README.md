# DAO ICO Contract

This repository holds the contract code for an Initial Coin Offering (ICO) designed for Decentralized Autonomous Organizations (DAOs). It allows DAOs to facilitate the sale of tokens from other protocols after a rigorous proposal review process. It has been carefully architected to incentivize DAOs to accept only top-quality proposals by distributing the fees earned through the ICO contract.

## Features

1. Proposal Review System: Only protocols that pass through the careful review process by DAO members can sell their tokens using this contract.
2. Fee Distribution: The fees generated from the ICO contract are split equally between a stablecoin and the token.
3. Token Lock Period: To ensure stability and long-term alignment of interests, the tokens earned as fees are locked for a period of 1 year.

## Installation

To install this project, clone the repository and install the dependencies.

```bash
$ git clone https://github.com/CleanPegasus/DAO-ICO.git
$ cd DAO-ICO
$ npm install
```

## Usage

1. Compile the contracts.

```bash
$ npx hardhat compile
```

2. Run the tests.

```bash
$ npx hardhat test
```

3. Deploy the contracts.

```bash
$ npx hardhat run scripts/deploy.js --network <network-name>
```
