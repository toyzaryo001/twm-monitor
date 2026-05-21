"use client";

import { bankLists } from "thai-banks-logo";

interface BankLogoProps {
    bankCode: string;
    size?: number;
}

// Map Thai bank names to bank codes
const bankNameToCode: Record<string, string> = {
    "กสิกรไทย": "KBANK",
    "KBANK": "KBANK",
    "กสิกร": "KBANK",
    "ไทยพาณิชย์": "SCB",
    "SCB": "SCB",
    "กรุงไทย": "KTB",
    "KTB": "KTB",
    "กรุงศรี": "BAY",
    "BAY": "BAY",
    "กรุงเทพ": "BBL",
    "BBL": "BBL",
    "ทีเอ็มบี": "TMB",
    "TMB": "TMB",
    "ทหารไทยธนชาต": "TMB",
    "TTB": "TMB",
    "ออมสิน": "GSB",
    "GSB": "GSB",
    "ธกส": "BAAC",
    "BAAC": "BAAC",
    "เพื่อการเกษตร": "BAAC",
    "อาคารสงเคราะห์": "GHB",
    "GHB": "GHB",
    "ซิตี้": "CITI",
    "CITI": "CITI",
    "ซีไอเอ็มบี": "CIMB",
    "CIMB": "CIMB",
    "ยูโอบี": "UOB",
    "UOB": "UOB",
    "เกียรตินาคิน": "KKP",
    "KKP": "KKP",
    "ทิสโก้": "TISCO",
    "TISCO": "TISCO",
    "แลนด์": "LHB",
    "LHB": "LHB",
    "ไทยเครดิต": "TCRB",
    "TCRB": "TCRB",
    "อิสลาม": "IBANK",
    "IBANK": "IBANK",
    "เอชเอสบีซี": "HSBC",
    "HSBC": "HSBC",
    "ไอซีบีซี": "ICBC",
    "ICBC": "ICBC",
    "พร้อมเพย์": "PromptPay",
    "PromptPay": "PromptPay",
    "ทรูมันนี่": "TrueMoney",
    "TrueMoney": "TrueMoney",
    "truemoney": "TrueMoney",
};

export function getBankCode(bankName: string): string | null {
    // Direct match
    if (bankNameToCode[bankName]) {
        return bankNameToCode[bankName];
    }

    // Partial match
    const lowerName = bankName.toLowerCase();
    for (const [key, code] of Object.entries(bankNameToCode)) {
        if (lowerName.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerName)) {
            return code;
        }
    }

    return null;
}

export function getBankInfo(bankCode: string) {
    const banks = bankLists as Record<string, { name: string; symbol: string; color: string; icon?: string; logo?: string }>;
    return banks[bankCode] || null;
}

export function BankLogo({ bankCode, size = 40 }: BankLogoProps) {
    const bank = getBankInfo(bankCode);

    if (!bank) {
        return (
            <div style={{
                width: size,
                height: size,
                borderRadius: "50%",
                background: "#333",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: size * 0.4,
                fontWeight: 700
            }}>
                🏦
            </div>
        );
    }

    return (
        <img
            src={bank.logo || bank.icon}
            alt={bank.name}
            style={{
                width: size,
                height: size,
                borderRadius: "50%",
                objectFit: "contain",
                background: "#fff"
            }}
        />
    );
}

export function BankLogoByName({ bankName, size = 40 }: { bankName: string; size?: number }) {
    const code = getBankCode(bankName);
    if (!code) {
        return (
            <div style={{
                width: size,
                height: size,
                borderRadius: "50%",
                background: "#333",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: size * 0.4,
                fontWeight: 700
            }}>
                🏦
            </div>
        );
    }
    return <BankLogo bankCode={code} size={size} />;
}

// Export all bank codes for dropdown
export const allBankCodes = Object.keys(bankLists as Record<string, unknown>);

export function getAllBanks() {
    const banks = bankLists as Record<string, { name: string; symbol: string; color: string; icon?: string; logo?: string }>;
    return Object.entries(banks).map(([code, info]) => ({
        code,
        ...info
    }));
}
