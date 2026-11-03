/**
 * TrueMoney P2P Transaction Validation Service
 * Implements TrueMoney Validate P2P API Version 1.6
 * Endpoint: https://apis.truemoneyservices.com/validate/v1/p2p
 */

export interface ValidateP2PParams {
    receiver_mobile: string;
    amount: number; // satang integer
    transaction_date: string; // yyyy-mm-dd HH:mm
    transaction_id?: string;
    sender_mobile?: string;
}

export interface ValidateP2PResult {
    ok: boolean;
    status: "ok" | "err";
    httpStatus: number;
    error?: {
        code: string;
        message: string;
        thaiExplanation: string;
    };
    raw?: any;
}

const TRUEMONEY_VALIDATE_ENDPOINT = "https://apis.truemoneyservices.com/validate/v1/p2p";

/**
 * Translates TrueMoney error codes and messages into clear Thai explanations
 */
export function translateTrueMoneyError(code: string, message: string): string {
    const msg = (message || "").toLowerCase();

    if (msg.includes("invalid 'transaction_id'") || msg.includes("transaction_id invalid")) {
        return "ไม่พบเลขที่รายการนี้ในระบบ TrueMoney (สลิปอาจเป็นสลิปปลอม หรือระบุเลขที่รายการไม่ถูกต้อง)";
    }
    if (msg.includes("invalid 'amount'") || msg.includes("amount mismatch")) {
        return "เลขที่รายการนี้มีอยู่จริง แต่มียอดเงินไม่ตรงกับสลิป (ตรวจพบการแก้ไขหรือดัดแปลงยอดเงิน)";
    }
    if (msg.includes("invalid 'transaction_date'") || msg.includes("date mismatch")) {
        return "เลขที่รายการนี้มีอยู่จริง แต่วันเวลาทำรายการไม่ตรงกับสลิป (ตรวจพบการแก้ไขวันเวลา)";
    }
    if (msg.includes("invalid 'receiver_mobile'") || msg.includes("receiver mismatch")) {
        return "เลขที่รายการนี้มีอยู่จริง แต่ไม่ได้โอนเข้าเบอร์วอลเล็ทนี้ (โอนเข้าบัญชีอื่น)";
    }
    if (msg.includes("invalid 'sender_mobile'") || msg.includes("sender mismatch")) {
        return "เบอร์ผู้โอนไม่ตรงกับข้อมูลธุรกรรมในระบบ TrueMoney";
    }
    if (msg.includes("180 day") || msg.includes("expired")) {
        return "ไม่พบรายการธุรกรรม หรือรายการนี้เกินกำหนดเวลา 180 วันที่ TrueMoney อนุญาตให้ตรวจสอบ";
    }
    if (code === "unauthorized" || msg.includes("token")) {
        return "Token ของวอลเล็ทนี้หมดอายุหรือไม่ถูกต้อง กรุณาอัปเดต Token ในหน้าจัดการวอลเล็ท";
    }

    return message || "ข้อมูลในสลิปไม่ตรงกับฐานข้อมูล TrueMoney หรือสลิปไม่ถูกต้อง";
}

/**
 * Validates a P2P transaction against TrueMoney API v1.6
 */
export async function validateP2PTransaction(
    bearerToken: string,
    params: ValidateP2PParams
): Promise<ValidateP2PResult> {
    if (!bearerToken || !bearerToken.trim()) {
        return {
            ok: false,
            status: "err",
            httpStatus: 400,
            error: {
                code: "MISSING_TOKEN",
                message: "No bearer token configured for this wallet",
                thaiExplanation: "วอลเล็ทนี้ยังไม่ได้ตั้งค่า Bearer Token กรุณาใส่ Token ในหน้าจัดการวอลเล็ทก่อน",
            },
        };
    }

    // Clean and normalize receiver mobile
    let receiver = params.receiver_mobile.replace(/\D/g, "");
    if (receiver.length === 4) {
        receiver = "000000" + receiver;
    } else if (receiver.length !== 10) {
        return {
            ok: false,
            status: "err",
            httpStatus: 400,
            error: {
                code: "INVALID_RECEIVER_MOBILE",
                message: "Receiver mobile must be 10 digits or 4 digits",
                thaiExplanation: "เบอร์ผู้รับเงินต้องเป็น 10 หลัก (หรือ 4 หลักท้าย)",
            },
        };
    }

    // Clean and normalize sender mobile
    let sender = (params.sender_mobile || "").replace(/\D/g, "");
    if (sender && sender.length !== 10) {
        sender = ""; // Fallback if malformed
    }

    // Ensure amount is integer satang
    const amountSatang = Math.round(params.amount);
    if (isNaN(amountSatang) || amountSatang <= 0) {
        return {
            ok: false,
            status: "err",
            httpStatus: 400,
            error: {
                code: "INVALID_AMOUNT",
                message: "Amount must be a positive integer in satang",
                thaiExplanation: "ยอดเงินต้องมากกว่า 0 บาท",
            },
        };
    }

    // Clean transaction ID (14 digits)
    const txId = (params.transaction_id || "").trim();

    const requestBody: any = {
        receiver_mobile: receiver,
        amount: amountSatang,
        transaction_date: params.transaction_date.trim(),
    };

    if (txId) {
        requestBody.transaction_id = txId;
    }
    if (sender) {
        requestBody.sender_mobile = sender;
    }

    try {
        const response = await fetch(TRUEMONEY_VALIDATE_ENDPOINT, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${bearerToken.trim()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });

        const httpStatus = response.status;
        const rawJson: any = await response.json().catch(() => null);

        if (response.ok && rawJson?.status === "ok") {
            return {
                ok: true,
                status: "ok",
                httpStatus,
                raw: rawJson,
            };
        }

        const errObj = rawJson?.err || {};
        const errCode = errObj.code || (httpStatus === 401 ? "unauthorized" : "error_transaction");
        const errMsg = errObj.message || (httpStatus === 401 ? "Unauthorized token" : "Validation failed");

        return {
            ok: false,
            status: "err",
            httpStatus,
            error: {
                code: errCode,
                message: errMsg,
                thaiExplanation: translateTrueMoneyError(errCode, errMsg),
            },
            raw: rawJson,
        };
    } catch (err: any) {
        return {
            ok: false,
            status: "err",
            httpStatus: 500,
            error: {
                code: "NETWORK_ERROR",
                message: err.message || "Failed to reach TrueMoney Validate API",
                thaiExplanation: "ไม่สามารถเชื่อมต่อ TrueMoney Validate API ได้ชั่วคราว กรุณาลองใหม่อีกครั้ง",
            },
            raw: { error: String(err) },
        };
    }
}
