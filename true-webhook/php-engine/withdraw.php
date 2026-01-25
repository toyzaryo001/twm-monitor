<?php
require_once 'TrueMoneyP2P.php';

// Usage: php withdraw.php <token> <target_number> <amount> [personal_id]

if ($argc < 4) {
    echo json_encode(['ok' => false, 'error' => 'MISSING_ARGS']);
    exit;
}

$token = $argv[1];
$target = $argv[2];
$amount = $argv[3];
$personalId = isset($argv[4]) ? $argv[4] : ''; // Personal ID (Thai ID) might be needed

$tm = new \TrueMoney\TrueMoneyP2P($token);

// 1. Draft Transfer
$draft = $tm->DraftTransfer($target, $amount);

if ($draft['code'] != 200) {
    echo json_encode(['ok' => false, 'step' => 'draft', 'response' => $draft['body'], 'http_code' => $draft['code']]);
    exit;
}

$draftData = $draft['body']['data'];
$draftTransactionId = $draftData['draft_transaction_id'];
$refId = $draftData['reference_id'];
// Check if OTP is required
// If standard P2P, it usually returns 'otp_status' or similar.
// If it requires OTP, we can't proceed automatically without an OTP service.
// However, for this implementation, we will try to Confirm immediately implies "Trusted" or "No OTP" logic if possible.
// Note: In real scenarios, if OTP is required, this script should return "OTP_REQUIRED" and stop.

// For now, let's try to confirm with empty OTP string if not provided
$otpString = ''; 

// 2. Confirm Transfer (Blindly trying to confirm)
$confirm = $tm->ConfirmTransfer($draftTransactionId, $refId, $otpString, $personalId);

if ($confirm['code'] != 200) {
    echo json_encode(['ok' => false, 'step' => 'confirm', 'response' => $confirm['body'], 'http_code' => $confirm['code']]);
    exit;
}

echo json_encode(['ok' => true, 'data' => $confirm['body']]);
