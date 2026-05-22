# Stratejik Partner SaaS Sistem Semasi

Bu dokuman, ProcureFlow icin kurulan cok kiracili satin alma yapisinin
ana parcalarini ve calisma akisini gosterir.

## 1) Platform ve Stratejik Partner Mimari Semasi

```mermaid
flowchart TB
    BA[Buyera Asistans Platformu]
    SA[Super Admin]
    PS[Platform Support / Operator]

    BA --> SA
    BA --> PS
    BA --> TG[Stratejik Partner Yonetimi]
    BA --> BILL[Billing Operasyonlari]
    BA --> DLAB[Discovery Lab Operasyonlari]

    TG --> T1[Stratejik Partner A]
    TG --> T2[Stratejik Partner B]

    T1 --> TO1[Stratejik Partner Sahibi]
    T1 --> TA1[Stratejik Partner Yoneticisi]
    T1 --> TM1[Stratejik Partner Uyesi]
    T1 --> TC1[Companies]
    T1 --> TD1[Departments]
    T1 --> TR1[Roles]
    T1 --> TP1[Projects]
    T1 --> TS1[Private Suppliers]
    T1 --> RFQ1[RFQ / Quotes]
    T1 --> AP1[Approvals]
    T1 --> SUB1[Stratejik Partner Aboneligi]

    TS1 --> SQ1[Supplier Quotes]
    RFQ1 --> SQ1
    RFQ1 --> AP1
    SUB1 --> INV1[Billing Invoices]
    SUB1 --> WEB1[Webhook Events]

    BA --> PNET[Platform Supplier Network]
    PNET --> T1
    PNET --> T2
```

## 2) Domain Veri Semasi

```mermaid
erDiagram
    TENANTS ||--o{ USERS : has
    TENANTS ||--o{ COMPANIES : owns
    TENANTS ||--o{ DEPARTMENTS : owns
    TENANTS ||--o{ ROLES : owns
    TENANTS ||--o{ PROJECTS : owns
    TENANTS ||--o{ SUPPLIERS : owns
    TENANTS ||--o{ QUOTES : scopes
    TENANTS ||--o{ QUOTE_APPROVALS : scopes
    TENANTS ||--o{ TENANT_SUBSCRIPTIONS : billed_by

    PROJECTS ||--o{ QUOTES : contains
    SUPPLIERS ||--o{ SUPPLIER_QUOTES : submits
    QUOTES ||--o{ QUOTE_ITEMS : contains
    QUOTES ||--o{ SUPPLIER_QUOTES : receives
    QUOTES ||--o{ QUOTE_APPROVALS : requires

    TENANT_SUBSCRIPTIONS ||--o{ BILLING_INVOICES : emits
    TENANT_SUBSCRIPTIONS ||--o{ BILLING_WEBHOOK_EVENTS : syncs
```

## 3) Uygulama Akisi

```mermaid
flowchart LR
    U[Kullanici] --> ROOT[/http://localhost:5175/]
    ROOT --> CHECK{Oturum var mi?}
    CHECK -- Hayir --> LOGIN[Login Page]
    CHECK -- Evet --> ROLE{System role / izin}

    ROLE -- Super Admin / Stratejik Partner Yonetimi / Platform Staff --> ADMIN[/admin]
    ROLE -- Procurement / Personel --> DASH[/dashboard]
    ROLE -- Supplier Session --> SUPPLIER[/supplier/dashboard]

    ADMIN --> TAB1[Platform Overview]
    ADMIN --> TAB2[Platform Operasyonlari]
    ADMIN --> TAB3[Discovery Lab Operasyonlari]
    ADMIN --> TAB4[Onboarding Studio]
    ADMIN --> TAB5[Stratejik Partner Yonetimi]
    ADMIN --> TAB6[Paket ve Kullanim / Billing]

    DASH --> RFQ[RFQ / Teklif Akislari]
    DASH --> REPORTS[Raporlar]
```

## 4) Discovery Lab ve Satin Alma Entegrasyonu

```mermaid
flowchart TB
    CAD[DWG / DXF Upload]
    EXT[Metadata Extractor]
    AI[AI Kesif Asistani]
    BOM[BOM Uretimi]
    AUDIT[Answer / Event Audit]
    LOCK[Teknik Onay]
    RFQ[RFQ / Quote Kaydi]

    CAD --> EXT
    EXT --> AI
    EXT --> BOM
    AI --> AUDIT
    BOM --> AUDIT
    AUDIT --> LOCK
    LOCK --> RFQ
```
