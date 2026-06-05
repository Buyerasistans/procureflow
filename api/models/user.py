# models\user.py
from typing import TYPE_CHECKING

from sqlalchemy import String, Boolean, ForeignKey, Integer, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.database import Base
from api.models.associations import (
    user_company,
    user_department,
)

if TYPE_CHECKING:
    from api.models.department import Department
    from api.models.company import Company
    from api.models.project import Project
    from api.models.assignment import CompanyRole, ProjectPermission
    from api.models.permission_override import UserPermissionOverride
    from api.models.tenant import Tenant


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    work_email: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(
        String(50),
        default="satinalmaci",
        nullable=False,
        comment="Role: super_admin, satinalma_direktoru, satinalma_yoneticisi, satinalma_uzmani, satinalmaci",
    )
    system_role: Mapped[str] = mapped_column(
        String(50),
        default="tenant_member",
        nullable=False,
        comment="System role: super_admin, platform_support, platform_operator, tenant_owner, tenant_admin, tenant_member, supplier_user",
    )
    approval_limit: Mapped[int] = mapped_column(
        Integer, default=100000, nullable=False, comment="Onay limitini TL cinsinden"
    )
    photo: Mapped[str | None] = mapped_column(Text, nullable=True)
    personal_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    company_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    company_phone_short: Mapped[str | None] = mapped_column(String(16), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    hide_location: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    share_on_whatsapp: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    hidden_from_admin: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    deleted_original_email: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id"), nullable=True, index=True
    )
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    invitation_token: Mapped[str | None] = mapped_column(
        String(255), nullable=True, unique=True, index=True
    )
    invitation_token_expires: Mapped[object | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    invitation_accepted: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    department_id: Mapped[int | None] = mapped_column(
        ForeignKey("departments.id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Social login
    google_id: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True, index=True)
    linkedin_id: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True, index=True)
    social_login_only: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # 2FA
    totp_secret: Mapped[str | None] = mapped_column(Text, nullable=True)
    totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Notifications
    login_notifications: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Faz B: 4-scope mimari genişlemesi
    scope_type: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="4-scope: platform | partner | supplier | channel",
    )
    role_profile_code: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Kanonik profil kodu, örn: partner.procurement_manager",
    )

    # Relationships
    tenant: Mapped["Tenant | None"] = relationship(
        "Tenant",
        back_populates="users",
        foreign_keys=[tenant_id],
    )
    department: Mapped["Department | None"] = relationship(
        "Department",
        back_populates="users",
        foreign_keys=[department_id],
    )
    companies: Mapped[list["Company"]] = relationship(
        secondary=user_company, back_populates="users"
    )
    user_departments: Mapped[list["Department"]] = relationship(
        secondary=user_department, back_populates="personnel_users"
    )
    projects: Mapped[list["Project"]] = relationship(
        secondary="user_projects", back_populates="personnel"
    )
    # Company-Role assignments (which roles in which companies)
    company_roles: Mapped[list["CompanyRole"]] = relationship(
        "CompanyRole", back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def company_assignments(self) -> list["CompanyRole"]:
        """Alias for company_roles, used by UserOut schema."""
        return self.company_roles

    # Project-based permissions
    project_permissions: Mapped[list["ProjectPermission"]] = relationship(
        "ProjectPermission",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="ProjectPermission.user_id",
    )
    permission_overrides: Mapped[list["UserPermissionOverride"]] = relationship(
        "UserPermissionOverride",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="UserPermissionOverride.user_id",
    )
