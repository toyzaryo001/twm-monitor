"use client";

import { ReactNode } from "react";

export function PageHeader({
    eyebrow,
    title,
    description,
    actions,
}: {
    eyebrow?: string;
    title: string;
    description?: string;
    actions?: ReactNode;
}) {
    return (
        <div className="page-header master-page-header">
            <div>
                {eyebrow && <div className="master-eyebrow">{eyebrow}</div>}
                <h1 className="page-title">{title}</h1>
                {description && <p className="master-page-description">{description}</p>}
            </div>
            {actions && <div className="master-actions">{actions}</div>}
        </div>
    );
}

export function StatCard({
    label,
    value,
    meta,
    tone = "cyan",
}: {
    label: string;
    value: ReactNode;
    meta?: ReactNode;
    tone?: "cyan" | "gold" | "green" | "red" | "violet";
}) {
    return (
        <div className={`stat-card master-stat master-stat-${tone}`}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
            {meta && <div className="master-stat-meta">{meta}</div>}
        </div>
    );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
    return (
        <div className="empty-state master-empty">
            <div className="master-empty-mark">-</div>
            <div className="master-empty-title">{title}</div>
            {description && <p>{description}</p>}
            {action && <div className="master-empty-action">{action}</div>}
        </div>
    );
}

export function ConfirmModal({
    title,
    message,
    confirmText,
    tone = "danger",
    busy,
    onCancel,
    onConfirm,
}: {
    title: string;
    message: ReactNode;
    confirmText: string;
    tone?: "danger" | "success";
    busy?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal master-confirm" onClick={(event) => event.stopPropagation()}>
                <div className={`master-confirm-icon ${tone}`}>{tone === "success" ? "OK" : "!"}</div>
                <h2 className="modal-title">{title}</h2>
                <div className="master-confirm-message">{message}</div>
                <div className="modal-actions">
                    <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
                        ยกเลิก
                    </button>
                    <button
                        type="button"
                        className={`btn ${tone === "success" ? "btn-primary" : "btn-danger"}`}
                        onClick={onConfirm}
                        disabled={busy}
                    >
                        {busy ? "กำลังดำเนินการ..." : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function StatusBadge({ active, trueText = "เปิดใช้งาน", falseText = "ปิดใช้งาน" }: { active: boolean; trueText?: string; falseText?: string }) {
    return <span className={`badge ${active ? "badge-success" : "badge-error"}`}>{active ? trueText : falseText}</span>;
}

export function TableShell({ children }: { children: ReactNode }) {
    return <div className="card master-table-card">{children}</div>;
}
