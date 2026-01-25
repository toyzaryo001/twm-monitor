/**
 * TrueMoney P2P Transfer Library (Node.js/TypeScript)
 * Replaces php-engine/TrueMoneyP2P.php
 */

const API_GATEWAY = 'https://mobile-api-gateway.truemoney.com/mobile-api-gateway';

interface ApiResponse {
    code: number;
    body: any;
    raw: string;
}

async function request(token: string, method: 'GET' | 'POST', uri: string, data?: any): Promise<ApiResponse> {
    const url = `${API_GATEWAY}${uri}`;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': token,
        'User-Agent': 'TrueMoney/5.44.0 (Android; 11; Mobile; en_TH)'
    };

    try {
        const response = await fetch(url, {
            method,
            headers,
            body: method === 'POST' && data ? JSON.stringify(data) : undefined
        });

        const raw = await response.text();
        let body: any = null;
        try {
            body = JSON.parse(raw);
        } catch (e) {
            body = { parseError: true, raw };
        }

        return {
            code: response.status,
            body,
            raw
        };
    } catch (error: any) {
        return {
            code: 0,
            body: { error: error.message },
            raw: error.message
        };
    }
}

/**
 * Step 1: Draft Transfer - Prepare a P2P transfer
 */
export async function draftTransfer(token: string, recipientMobile: string, amount: number): Promise<ApiResponse> {
    // Clean mobile number
    const cleanMobile = recipientMobile.replace(/[-\s]/g, '');

    const payload = {
        amount: amount.toFixed(2),
        recipient_mobile_number: cleanMobile
    };

    return request(token, 'POST', '/transfer-service-one/v2/transfer/draft', payload);
}

/**
 * Step 2: Confirm Transfer - Execute the transfer
 */
export async function confirmTransfer(
    token: string,
    draftTransactionId: string,
    refId: string,
    otpString: string = '',
    personalId: string = ''
): Promise<ApiResponse> {
    const payload = {
        draft_transaction_id: draftTransactionId,
        reference_id: refId,
        otp_string: otpString,
        personal_id: personalId
    };

    return request(token, 'POST', '/transfer-service-one/v2/transfer/confirm', payload);
}

/**
 * Execute full P2P transfer (Draft + Confirm)
 */
export async function executeTransfer(
    token: string,
    recipientMobile: string,
    amount: number,
    personalId: string = ''
): Promise<{ ok: boolean; step?: string; error?: string; data?: any; response?: any; httpCode?: number }> {

    // Step 1: Draft Transfer
    const draft = await draftTransfer(token, recipientMobile, amount);

    if (draft.code !== 200) {
        return {
            ok: false,
            step: 'draft',
            response: draft.body,
            httpCode: draft.code
        };
    }

    const draftData = draft.body?.data;
    if (!draftData) {
        return {
            ok: false,
            step: 'draft',
            error: 'NO_DRAFT_DATA',
            response: draft.body
        };
    }

    const draftTransactionId = draftData.draft_transaction_id;
    const refId = draftData.reference_id;

    // Step 2: Confirm Transfer
    const confirm = await confirmTransfer(token, draftTransactionId, refId, '', personalId);

    if (confirm.code !== 200) {
        return {
            ok: false,
            step: 'confirm',
            response: confirm.body,
            httpCode: confirm.code
        };
    }

    return {
        ok: true,
        data: confirm.body
    };
}
