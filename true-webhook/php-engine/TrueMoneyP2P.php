<?php
namespace TrueMoney;

class TrueMoneyP2P {
    private $token;
    private $deviceId = ''; // Optional/Generated
    private $mobileTracking = ''; // Optional
    
    private $api_gateway = 'https://mobile-api-gateway.truemoney.com/mobile-api-gateway';

    public function __construct($token) {
        $this->token = $token;
    }

    private function request($method, $uri, $data = null) {
        $url = $this->api_gateway . $uri;
        $headers = [
            'Content-Type: application/json',
            'Authorization: ' . $this->token,
            'User-Agent: TrueMoney/5.44.0 (Android; 11; Mobile; en_TH)'
        ];

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        
        if ($method == 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($data) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            }
        }

        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return [
            'code' => $httpCode,
            'body' => json_decode($result, true),
            'raw' => $result
        ];
    }

    public function DraftTransfer($recipientMobile, $amount) {
        // Prepare mobile number (remove leading 0, add 66)?? 
        // Actually TMW usually accepts 08xxxxxxxx or 668xxxxxxx. 
        // Let's standard to 10 digits 08xxxxxxxx for simplicity or let API handle it.
        $cleanMobile = str_replace(['-', ' '], '', $recipientMobile);

        $payload = [
            'amount' => number_format($amount, 2, '.', ''),
            'recipient_mobile_number' => $cleanMobile
        ];

        // This endpoint might vary by version, using v2 standard for automatic transfers
        return $this->request('POST', '/transfer-service-one/v2/transfer/draft', $payload);
    }

    public function ConfirmTransfer($draftTransactionId, $refId, $otpString, $personalId = null) {
        $payload = [
            'draft_transaction_id' => $draftTransactionId,
            'reference_id' => $refId, // from draft response
            'otp_string' => $otpString,
            'personal_id' => $personalId // Required usually for P2P
        ];

        return $this->request('POST', '/transfer-service-one/v2/transfer/confirm', $payload);
    }
    
    // Check balance is usually GET /user-profile-composite/v1/users/balance/
}
