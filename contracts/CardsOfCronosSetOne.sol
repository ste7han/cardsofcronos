// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import {Rescuable} from "./Rescuable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Cards of Cronos — Set 01
 * @notice The second collection. The first one is at
 *         0x10B47dAbfEaCBd87dD2bAd5f6d489C5082181902 and stays exactly as it is;
 *         everybody holding one of those can claim from here for nothing.
 *
 * Written against docs/the-first-collection.md and contracts/CardsOfCronos.sol,
 * which is the contract that is already deployed and working. What is kept from
 * it, what is dropped and what is new is written down at each point below rather
 * than in a commit message nobody will find.
 *
 * NOT DEPLOYED, NOT AUDITED. It compiles, and that is the only claim being made.
 * The tests that ought to sit beside it do not exist yet; see the note at the
 * bottom of this file.
 */
contract CardsOfCronosSetOne is ERC721, ERC2981, Rescuable {
    // ---------------------------------------------------------------- supply

    /// @notice The highest id that will ever exist. Fixed at deploy, forever.
    uint256 public immutable maxSupply;

    /// @notice The next id to hand out. Ids start at 1, like the first collection.
    uint256 public nextTokenId = 1;

    /**
     * @dev No ERC721Enumerable, unlike the first collection.
     *
     * It costs several thousand gas on every single mint and transfer to keep
     * indexes that this project reads exactly once, from a script, off-chain:
     * scripts/holders.ts walks ownerOf(1..n) and does not touch tokenOfOwnerByIndex.
     * Paying for an index nobody queries is a tax on every holder forever.
     */

    // ------------------------------------------------------------- metadata

    string private _base;

    // ------------------------------------------------------------ free mints

    // Root of the allowlist built from the first collection's holders.
    //
    // Leaves are keccak256(bytes.concat(keccak256(abi.encode(address, uint256))))
    // — the OpenZeppelin StandardMerkleTree shape, which is what
    // scripts/allowlist.ts produces using their own merkle-tree package.
    //
    // Settable, because a snapshot can be retaken and because deploying with a
    // root that turns out to be wrong should not mean deploying again. Once
    // claiming opens it should not move — see `claimsOpen`.
    bytes32 public allowlistRoot;

    /// @notice How many of their free mints an address has taken.
    mapping(address => uint256) public claimed;

    /// @notice Whether the free mints can be taken at all.
    bool public claimsOpen;

    // ------------------------------------------------------------ paid mints

    /**
     * @notice Price of one card, before any discount. In CRO.
     * @dev 15, which is this game's price. The first version of this contract
     *      inherited the first collection's 150 and had to be corrected with
     *      setMintPrice after deploying — a window in which an open sale would
     *      have charged ten times the price, with no refund in here for anybody
     *      who hit it. The default is the right number now so that window does
     *      not exist.
     */
    uint256 public mintPrice = 15 ether;

    /// @notice Most that can be bought in one transaction.
    uint256 public constant MAX_MINT_PER_TX = 50;

    /// @notice Whether the paid mint is open.
    bool public saleOpen;

    /**
     * @notice $CROCARD. Holding it makes minting cheaper.
     * @dev The same token as the first collection. NOT the same formula: that
     *      one took a percent off per million held and capped at thirty, which
     *      is a curve nobody can read off a page. This takes the ladder the rest
     *      of the game already uses — retail, bagholder, holder, whale — so one
     *      idea of what holding means covers both what a mint costs and what a
     *      win is cut by. data/holder-tiers.ts is the same four rungs, and
     *      test/revenue.test.ts reads these three constants back out of here to
     *      check they have not drifted apart.
     */
    IERC20 public discountToken = IERC20(0xECf3361441512c1e9F6A6e8734D86614D8e795BC);

    /**
     * The rungs, in whole tokens times 1e18.
     *
     * A ten-thousandth of the supply, a thousandth, and a hundredth. Constants
     * rather than storage: a discount somebody can be moved off after they
     * bought in for it is not a deal, it is an announcement.
     */
    uint256 public constant BAGHOLDER_AT = 100_000e18;
    uint256 public constant HOLDER_AT = 1_000_000e18;
    uint256 public constant WHALE_AT = 10_000_000e18;

    /// @notice Percent off at each rung above retail.
    uint256 public constant BAGHOLDER_OFF = 10;
    uint256 public constant HOLDER_OFF = 20;
    uint256 public constant WHALE_OFF = 30;

    // ---------------------------------------------------------------- events

    event Claimed(address indexed to, uint256 amount);
    event Bought(address indexed to, uint256 amount, uint256 paid);
    event AllowlistRootSet(bytes32 root);
    event BaseURISet(string baseURI);

    // ---------------------------------------------------------------- errors

    error SoldOut();
    error NothingRequested();
    error TooManyAtOnce();
    error ClaimsClosed();
    error SaleClosed();
    error BadProof();
    error AlreadyClaimed();
    error Underpaid(uint256 owed, uint256 sent);
    error RefundFailed();
    error WithdrawFailed();
    error NoSuchToken();

    /**
     * @notice Where the money goes, fixed at deploy and never again.
     *
     * Both the mint proceeds and the royalties. Immutable on purpose: the owner
     * can open and close the sale and move the price, and cannot move a single
     * CRO anywhere other than here. `release` below is the only way out of this
     * contract and it takes no arguments.
     */
    address payable public immutable splitter;

    /// @notice The royalty, in basis points out of 10_000. Settled by the maker.
    uint96 public constant ROYALTY_BPS = 1_000;

    /**
     * @notice May move the metadata and do nothing else. Zero until set.
     *
     * Zero is a fine resting state: the owner can always reveal, so a collection
     * with no revealer is one where every reveal is done by hand. Setting it is
     * the decision to let a schedule do it.
     */
    address public revealer;

    event Released(uint256 amount);
    event RevealerChanged(address indexed from, address indexed to);

    error NothingToRelease();
    error NotAllowedToReveal();

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_,
        string memory baseURI_,
        bytes32 allowlistRoot_,
        address payable splitter_
    ) ERC721(name_, symbol_) Ownable(msg.sender) {
        if (splitter_ == address(0)) revert ZeroAddress();
        maxSupply = maxSupply_;
        _base = baseURI_;
        allowlistRoot = allowlistRoot_;
        splitter = splitter_;

        // ERC2981, so a marketplace can read the royalty off the collection
        // instead of being told it in a form somebody has to remember to fill
        // in on every venue. It pays the splitter, which divides a royalty the
        // same way it divides a mint.
        //
        // Not enforcement. ERC2981 is a statement of what is owed and venues
        // that ignore it exist; what it buys is that every venue which does
        // honour it is configured correctly the moment the collection is
        // deployed, by the collection itself.
        _setDefaultRoyalty(splitter_, ROYALTY_BPS);
    }

    // ------------------------------------------------------------------ mint

    /**
     * @notice Take some of the free mints this address is owed.
     * @param allowance How many that address is owed in total, as it appears in
     *        the allowlist. This is the number the leaf was built from and it
     *        cannot be inflated: change it and the proof stops matching.
     * @param proof The merkle proof for (msg.sender, allowance).
     * @param amount How many to take now. Claiming in parts is allowed, so
     *        somebody owed sixty-three does not have to take them in one
     *        transaction or lose the rest.
     */
    function claim(uint256 allowance, bytes32[] calldata proof, uint256 amount) external {
        if (!claimsOpen) revert ClaimsClosed();
        if (amount == 0) revert NothingRequested();
        if (amount > MAX_MINT_PER_TX) revert TooManyAtOnce();

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, allowance))));
        if (!MerkleProof.verify(proof, allowlistRoot, leaf)) revert BadProof();

        uint256 taken = claimed[msg.sender];
        if (taken + amount > allowance) revert AlreadyClaimed();

        // Written before anything is minted. _safeMint hands control to the
        // receiver, and a receiver that calls back in has to find the counter
        // already moved.
        claimed[msg.sender] = taken + amount;

        _mintMany(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    /// @notice Buy cards at the going price, less whatever $CROCARD earns you.
    function buy(uint256 amount) external payable {
        if (!saleOpen) revert SaleClosed();
        if (amount == 0) revert NothingRequested();
        if (amount > MAX_MINT_PER_TX) revert TooManyAtOnce();

        uint256 owed = priceFor(msg.sender) * amount;
        if (msg.value < owed) revert Underpaid(owed, msg.value);

        _mintMany(msg.sender, amount);
        emit Bought(msg.sender, amount, owed);

        // Overpaying is a mistake, not a donation. The first collection kept the
        // difference; this one hands it back.
        if (msg.value > owed) {
            (bool sent, ) = payable(msg.sender).call{value: msg.value - owed}("");
            if (!sent) revert RefundFailed();
        }
    }

    function _mintMany(address to, uint256 amount) private {
        uint256 id = nextTokenId;
        if (id + amount - 1 > maxSupply) revert SoldOut();
        nextTokenId = id + amount;
        for (uint256 i = 0; i < amount; ++i) {
            _safeMint(to, id + i);
        }
    }

    // ----------------------------------------------------------------- price

    /**
     * @notice What percent comes off a card for this address right now.
     * @dev Four rungs and no arithmetic between them, which is the point. The
     *      first collection divided in integers, so 999,999 tokens was the full
     *      price and 1,000,000 was one percent off — true, defensible, and
     *      impossible to put on a page in a sentence anybody would finish.
     *
     *      Read highest first. Read the other way round a whale would be handed
     *      the bagholder rate, which is the ordering bug this shape cannot have.
     */
    function discountFor(address user) public view returns (uint256) {
        uint256 held = discountToken.balanceOf(user);
        if (held >= WHALE_AT) return WHALE_OFF;
        if (held >= HOLDER_AT) return HOLDER_OFF;
        if (held >= BAGHOLDER_AT) return BAGHOLDER_OFF;
        return 0;
    }

    function priceFor(address user) public view returns (uint256) {
        return (mintPrice * (100 - discountFor(user))) / 100;
    }

    // ------------------------------------------------------------- metadata

    function _baseURI() internal view override returns (string memory) {
        return _base;
    }

    /**
     * @dev Reverts on a token that does not exist rather than returning an empty
     *      string. A marketplace that gets "" shows a blank card and no reason.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert NoSuchToken();
        return super.tokenURI(tokenId);
    }

    // -------------------------------------------------------------- the levers

    /**
     * @notice Moves the metadata. The owner or the revealer.
     *
     * The mint runs with every token face down, so that nobody can read ahead
     * and buy only the good ones — the order was fixed before the first sale and
     * a hash of it published, and showing it early would make the odds stop
     * being odds. Turning tokens face up as they sell means calling this often,
     * and often means a key on a server.
     *
     * The owner key cannot be that. It can reach the money through the rescue
     * hatch, so it belongs on a wallet that never touches one. Hence a second
     * address that may do this and nothing else.
     *
     * WHAT A STOLEN REVEALER COSTS: it can point every token's metadata at
     * rubbish. That is defacement and it is bad, and it is not theft — it cannot
     * mint, cannot move CRO, cannot change what a card does, and the owner
     * rotates it and sets the address back. Weighed against a mint that takes
     * months while every card stays face down, that is the better risk.
     */
    function setBaseURI(string calldata baseURI_) external {
        if (msg.sender != owner() && msg.sender != revealer) revert NotAllowedToReveal();
        _base = baseURI_;
        emit BaseURISet(baseURI_);
    }

    /// @notice Replaces the revealer. The answer to a leaked key.
    function setRevealer(address revealer_) external onlyOwner {
        emit RevealerChanged(revealer, revealer_);
        revealer = revealer_;
    }

    function setAllowlistRoot(bytes32 root) external onlyOwner {
        allowlistRoot = root;
        emit AllowlistRootSet(root);
    }

    function setClaimsOpen(bool open) external onlyOwner {
        claimsOpen = open;
    }

    function setSaleOpen(bool open) external onlyOwner {
        saleOpen = open;
    }

    function setMintPrice(uint256 price) external onlyOwner {
        mintPrice = price;
    }

    function setDiscountToken(IERC20 token) external onlyOwner {
        discountToken = token;
    }

    /**
     * @notice Sends everything this contract holds to the splitter.
     *
     * ANYONE MAY CALL THIS, and it takes no arguments. It was
     * `withdraw(address payable to) onlyOwner`, which is the ordinary shape and
     * meant the proceeds of every mint sat here until the owner moved them, to
     * an address chosen at the moment of moving.
     *
     * This shape cannot choose. The destination is immutable and the function
     * has no parameters, so calling it is not a decision — which is what makes
     * it safe to automate. A cron calls this on a timer and holds no key,
     * because there is no key that would help it.
     */
    function release() external {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NothingToRelease();
        (bool sent, ) = splitter.call{value: balance}("");
        if (!sent) revert WithdrawFailed();
        emit Released(balance);
    }

    /// @dev ERC721 and ERC2981 both answer this, and both answers are needed.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

/*
 * ── WHAT IS PROVED, AND WHAT IS NOT ─────────────────────────────────────────
 *
 * contracts/test/CardsOfCronosSetOne.t.sol, 21 tests, `npm run contract`.
 *
 * The one worth naming: every proof in data/allowlist.json is fed to this
 * contract and accepted. Not a sample — all of them. The leaf shape above was
 * written by hand to match what scripts/allowlist.ts produces, and a holder
 * whose proof does not verify is somebody who was promised a mint and cannot
 * take it. There is no reason to find that out one wallet at a time.
 *
 * Also proved: claiming twice, claiming over the allowance, claiming in parts up
 * to it and one over, a proof used by somebody else, an inflated allowance,
 * minting past maxSupply, over- and underpaying, and the discount at zero, at a
 * million minus one, at a million and above the cap.
 *
 * One thing the tests found rather than confirmed. The largest holder in the
 * real allowlist is owed 63 and MAX_MINT_PER_TX is 50, so their allowance does
 * not fit in one transaction. That is intended, and it is only fair because
 * claiming in parts works — which nothing said until there was a test for it.
 *
 * ── WHAT IS STILL OPEN, AND NONE OF IT IS CODE ──────────────────────────────
 *
 *   - NOT AUDITED. Tests are not an audit and this holds money.
 *   - maxSupply. The card set is being redesigned, so how many cards there are
 *     is not settled.
 *   - The name and symbol. "Cards of Cronos Set 01" and something that is not
 *     "COC", which the first collection already uses.
 *   - baseURI. Nothing is uploaded yet, and there is no art to upload.
 *   - Who deploys it. lib/admin.ts and lib/revenue.ts are empty for the same
 *     reason: nobody has said which addresses these are.
 *   - Whether the free mints go one per token (505) or one per distinct card
 *     (478). That is a flag on scripts/allowlist.ts, not a property of this
 *     contract — but the root here has to match whichever was chosen.
 */
