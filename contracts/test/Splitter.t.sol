// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";

import {Splitter} from "../Splitter.sol";
import {Rescuable} from "../Rescuable.sol";

/**
 * The one split there is, and the reason it needs nobody's permission.
 *
 * What these have to prove is not that division works. It is that `release`
 * cannot be steered: not by who calls it, not by arguments (it has none), and
 * not by the owner (there is none). That is the whole safety argument for
 * putting it on a timer, and an argument is worth exactly what its tests are.
 */
contract SplitterTest is Test {
    Splitter private splitter;

    address private holders = address(0xA1);
    address private burner = address(0xB2);
    address private pot = address(0xC3);

    function setUp() public {
        splitter = new Splitter(payable(holders), payable(burner), payable(pot));
    }

    function test_dividesFiftyTwentyFiveTwentyFive() public {
        vm.deal(address(splitter), 100 ether);
        splitter.release();

        assertEq(holders.balance, 50 ether, "half to the people holding the token");
        assertEq(burner.balance, 25 ether, "a quarter burned");
        assertEq(pot.balance, 25 ether, "a quarter to the weekly pot");
        assertEq(address(splitter).balance, 0, "and nothing kept back");
    }

    /**
     * A stranger gets the same result as anybody else, which is the point.
     *
     * If this ever stops being true, the cron that calls it needs a key, and the
     * key needs somewhere to live, and the whole argument for this shape is
     * gone.
     */
    function test_anybodyMayCallIt() public {
        vm.deal(address(splitter), 4 ether);
        vm.prank(address(0xDEAD));
        splitter.release();
        assertEq(holders.balance, 2 ether);
    }

    /** Nothing is left behind, however awkward the number. */
    function testFuzz_everythingIsSentSomewhere(uint96 amount) public {
        vm.assume(amount > 0);
        vm.deal(address(splitter), amount);
        splitter.release();

        assertEq(address(splitter).balance, 0, "no dust accumulates");
        assertEq(
            holders.balance + burner.balance + pot.balance,
            amount,
            "every wei arrived somewhere"
        );
    }

    /**
     * The remainder goes to the pot rather than staying here.
     *
     * Three wei is the smallest amount that cannot divide cleanly, and an
     * implementation that floors all three shares would leave one behind — once
     * per release, forever, with nothing able to pay it out.
     */
    function test_theRemainderIsNotStranded() public {
        vm.deal(address(splitter), 3 wei);
        splitter.release();
        assertEq(holders.balance, 1 wei);
        assertEq(burner.balance, 0);
        assertEq(pot.balance, 2 wei, "the odd wei lands in the pot");
        assertEq(address(splitter).balance, 0);
    }

    function test_releasingNothingReverts() public {
        vm.expectRevert(Splitter.NothingToRelease.selector);
        splitter.release();
    }

    /** A zero destination is money burned by accident, on every release. */
    function test_refusesAZeroDestination() public {
        vm.expectRevert(Rescuable.ZeroAddress.selector);
        new Splitter(payable(address(0)), payable(burner), payable(pot));
        vm.expectRevert(Rescuable.ZeroAddress.selector);
        new Splitter(payable(holders), payable(address(0)), payable(pot));
        vm.expectRevert(Rescuable.ZeroAddress.selector);
        new Splitter(payable(holders), payable(burner), payable(address(0)));
    }

    /** It takes CRO from anywhere, because a marketplace does not announce itself. */
    function test_acceptsAPlainTransfer() public {
        address sender = address(0xF00D);
        vm.deal(sender, 1 ether);
        vm.prank(sender);
        (bool sent, ) = address(splitter).call{value: 1 ether}("");
        assertTrue(sent, "a royalty that reverts is a sale that reverts");
        assertEq(address(splitter).balance, 1 ether);
    }

    /** The shares are constants. Nobody can move them, including the deployer. */
    function test_theSplitHasNoAdmin() public view {
        assertEq(splitter.HOLDERS_BPS(), 5_000);
        assertEq(splitter.BURN_BPS(), 2_500);
        assertEq(splitter.POT_BPS(), 2_500);
        assertEq(
            splitter.HOLDERS_BPS() + splitter.BURN_BPS() + splitter.POT_BPS(),
            10_000,
            "a split that does not add up leaves a remainder with nowhere to go"
        );
    }
}
