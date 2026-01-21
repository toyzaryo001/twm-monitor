"use client";

export default function TenantSettingsPage() {
    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">ตั้งค่า</h1>
            </div>

            <div className="card">
                <div className="card-title">การแจ้งเตือน Telegram</div>
                <p style={{ color: "var(--text-secondary)" }}>
                    ไปที่หน้า จัดการบัญชี แล้วเลือกบัญชีเพื่อตั้งค่า Telegram
                </p>
            </div>
        </div>
    );
}
