// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/** $CROCARD for the tests, with an optional fee on transfer. */
contract FakeCard {
    mapping(address => uint256) public balanceOf;
    uint256 public feeBps;

    function setFee(uint256 bps) external {
        feeBps = bps;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount - (amount * feeBps) / 10_000;
        return true;
    }
}
