module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
      gas: 6721975,
      websockets: true,
    },
  },
  compilers: {
    solc: {
      version: "^0.4.24",
    },
  },
};

