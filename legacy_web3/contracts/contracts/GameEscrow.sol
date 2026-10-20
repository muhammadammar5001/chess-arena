// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract GameEscrow is AccessControl, EIP712, ReentrancyGuard {

    bytes32 public constant SETTLEMENT_ROLE = keccak256("SETTLEMENT_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    // EIP712 TypeHash for Settlement
    bytes32 private constant SETTLEMENT_TYPEHASH = keccak256(
        "Settlement(string matchId,uint256 rulesVersion,address winner,address loser,uint256 stakeAmount,uint256 payoutAmount,uint256 feeAmount,uint256 referralAmount,uint256 chainId,address escrowContract,uint256 nonce,uint256 deadline)"
    );

    mapping(string => bool) public settledMatches;
    
    event MatchSettled(string matchId, address winner, uint256 payout);

    constructor() EIP712("OwlsGambit", "1") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TREASURY_ROLE, msg.sender);
    }

    function deposit() external payable {
        // Simple logic for locking funds to enter matchmaking
    }

    function settleMatch(
        string calldata matchId,
        uint256 rulesVersion,
        address winner,
        address loser,
        uint256 stakeAmount,
        uint256 payoutAmount,
        uint256 feeAmount,
        uint256 referralAmount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant {
        require(block.timestamp <= deadline, "Settlement expired");
        require(!settledMatches[matchId], "Match already settled");
        
        bytes32 structHash = keccak256(abi.encode(
            SETTLEMENT_TYPEHASH,
            keccak256(bytes(matchId)),
            rulesVersion,
            winner,
            loser,
            stakeAmount,
            payoutAmount,
            feeAmount,
            referralAmount,
            block.chainid,
            address(this),
            nonce,
            deadline
        ));

        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(hash, signature);
        require(hasRole(SETTLEMENT_ROLE, signer), "Invalid signature");

        settledMatches[matchId] = true;

        if(payoutAmount > 0) {
            payable(winner).transfer(payoutAmount);
        }
        
        emit MatchSettled(matchId, winner, payoutAmount);
    }
}
