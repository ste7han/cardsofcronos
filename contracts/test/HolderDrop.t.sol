// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";

import {HolderDrop} from "../HolderDrop.sol";
import {Rescuable} from "../Rescuable.sol";

/**
 * The half that goes back to $CROCARD holders.
 *
 * Proofs come from a tree built by OpenZeppelin's own merkle-tree package, read
 * off disk rather than reproduced here — the same arrangement the allowlist test
 * uses and for the same reason. The leaf shape in the contract was written to
 * match what that package produces, and "written to match" is a claim this
 * project does not accept anywhere else.
 */
contract HolderDropTest is Test {
    HolderDrop private drop;

    address private publisher = address(0xBEEF);
    address private stranger = address(0x5A);

    string private fixtureJson;
    bytes32 private root;

    address private a11 = 0x0000000000000000000000000000000000000a11;
    address private b22 = 0x0000000000000000000000000000000000000b22;

    function setUp() public {
        fixtureJson = vm.readFile("data/drop-fixture.json");
        root = vm.parseJsonBytes32(fixtureJson, ".root");

        drop = new HolderDrop(publisher);
        vm.deal(address(drop), 10 ether);
    }

    function proofFor(uint256 i) private view returns (bytes32[] memory) {
        return vm.parseJsonBytes32Array(
            fixtureJson,
            string.concat(".entries[", vm.toString(i), "].proof")
        );
    }

    function test_aRealProofIsAccepted() public {
        vm.prank(publisher);
        drop.openRound(1, root);

        drop.claim(1, a11, 5 ether, proofFor(0));
        assertEq(a11.balance, 5 ether, "the share the tree says, to the wei");
    }

    /** Everybody in the tree can take theirs, and together it is the round. */
    function test_everyShareAddsUpToTheRound() public {
        vm.prank(publisher);
        drop.openRound(1, root);

        drop.claim(1, a11, 5 ether, proofFor(0));
        drop.claim(1, b22, 3 ether, proofFor(1));
        drop.claim(1, 0x0000000000000000000000000000000000000c33, 1.5 ether, proofFor(2));
        drop.claim(1, 0x0000000000000000000000000000000000000d44, 0.5 ether, proofFor(3));

        assertEq(address(drop).balance, 0, "the round paid out exactly");
        assertEq(drop.allocated(), 0);
    }

    /** It pays the holder in the proof, never the caller. */
    function test_anybodyMayPushAShare() public {
        vm.prank(publisher);
        drop.openRound(1, root);

        vm.prank(stranger);
        drop.claim(1, a11, 5 ether, proofFor(0));

        assertEq(a11.balance, 5 ether);
        assertEq(stranger.balance, 0, "pushing somebody's share earns nothing");
    }

    function test_aShareIsTakenOnce() public {
        vm.prank(publisher);
        drop.openRound(1, root);
        drop.claim(1, a11, 5 ether, proofFor(0));

        vm.expectRevert(HolderDrop.AlreadyClaimed.selector);
        drop.claim(1, a11, 5 ether, proofFor(0));
    }

    /** An amount that is not the one in the tree is not in the tree. */
    function test_inflatingTheAmountBreaksTheProof() public {
        vm.prank(publisher);
        drop.openRound(1, root);

        vm.expectRevert(HolderDrop.BadProof.selector);
        drop.claim(1, a11, 6 ether, proofFor(0));
    }

    function test_somebodyElsesProof() public {
        vm.prank(publisher);
        drop.openRound(1, root);

        vm.expectRevert(HolderDrop.BadProof.selector);
        drop.claim(1, stranger, 5 ether, proofFor(0));
    }

    // ── what the publisher cannot do ────────────────────────────────────────

    function test_onlyThePublisherOpensARound() public {
        vm.prank(stranger);
        vm.expectRevert(HolderDrop.NotThePublisher.selector);
        drop.openRound(1, root);
    }

    function test_aRoundIsOpenedOnce() public {
        vm.startPrank(publisher);
        drop.openRound(1, root);
        vm.expectRevert(HolderDrop.RoundAlreadyOpen.selector);
        drop.openRound(1, bytes32(uint256(1)));
        vm.stopPrank();
    }

    /**
     * A tree that promises more than the round holds cannot drain the next one.
     *
     * The tree is built off chain and this is the only thing between a mistake
     * there and holders in a later round finding their share already spent.
     */
    function test_aTreeThatPromisesTooMuchIsCutOff() public {
        // Six ether against a tree that promises ten. The first share fits and
        // the second does not, which is the moment that has to be caught — not
        // the first, which would fail for the ordinary reason of being too big.
        drop = new HolderDrop(publisher);
        vm.deal(address(drop), 6 ether);

        vm.prank(publisher);
        drop.openRound(1, root);

        drop.claim(1, a11, 5 ether, proofFor(0));
        vm.expectRevert(HolderDrop.TooMuchClaimed.selector);
        drop.claim(1, b22, 3 ether, proofFor(1));
    }

    // ── what nobody takes comes back ────────────────────────────────────────

    function test_unclaimedSharesReturnToThePool() public {
        vm.prank(publisher);
        drop.openRound(1, root);
        drop.claim(1, a11, 5 ether, proofFor(0));

        vm.expectRevert(abi.encodeWithSelector(HolderDrop.NotExpiredYet.selector, block.timestamp + 90 days));
        drop.sweep(1);

        vm.warp(block.timestamp + 90 days);
        drop.sweep(1);

        assertEq(drop.allocated(), 0, "nothing is spoken for any more");
        assertEq(drop.unallocated(), 5 ether, "and it is in the next round");
    }

    function test_aRoundIsSweptOnce() public {
        vm.prank(publisher);
        drop.openRound(1, root);
        vm.warp(block.timestamp + 90 days);
        drop.sweep(1);

        vm.expectRevert(HolderDrop.AlreadySwept.selector);
        drop.sweep(1);
    }

    function test_openingWithNothingToShare() public {
        drop = new HolderDrop(publisher);
        vm.prank(publisher);
        vm.expectRevert(HolderDrop.NothingToShare.selector);
        drop.openRound(1, root);
    }

    function test_claimingFromARoundThatDoesNotExist() public {
        vm.expectRevert(HolderDrop.NoSuchRound.selector);
        drop.claim(7, a11, 5 ether, proofFor(0));
    }

    function test_theOwnerCanRotateThePublisher() public {
        drop.setPublisher(stranger);
        vm.prank(publisher);
        vm.expectRevert(HolderDrop.NotThePublisher.selector);
        drop.openRound(1, root);
    }

    function test_theRescueHatchIsHereToo() public {
        address safe = address(0x5AFE);
        drop.announceRescue(safe);
        vm.warp(block.timestamp + 2 days);
        drop.rescue();
        assertEq(safe.balance, 10 ether);
    }

    function test_refusesAZeroPublisher() public {
        vm.expectRevert(Rescuable.ZeroAddress.selector);
        new HolderDrop(address(0));
    }
}
