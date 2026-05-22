from typing import Literal

from pydantic import BaseModel, Field


class WorkspacePanelQuickLink(BaseModel):
    label: str = Field(..., min_length=1, max_length=120)
    href: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1, max_length=280)


class WorkspacePanelProfile(BaseModel):
    business_role: str = Field(..., min_length=1, max_length=100)
    system_role: str | None = Field(default=None, max_length=100)
    title: str = Field(..., min_length=1, max_length=120)
    nav_label: str = Field(..., min_length=1, max_length=80)
    workspace_label: str = Field(..., min_length=1, max_length=120)
    description: str = Field(..., min_length=1, max_length=500)
    hero_title: str = Field(..., min_length=1, max_length=160)
    hero_description: str = Field(..., min_length=1, max_length=600)
    top_notice: str | None = Field(default=None, max_length=160)
    header_info: str | None = Field(default=None, max_length=240)
    footer_info: str | None = Field(default=None, max_length=240)
    header_bg_color: str | None = Field(
        default=None, pattern=r"^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$"
    )
    header_text_color: str | None = Field(
        default=None, pattern=r"^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$"
    )
    footer_bg_color: str | None = Field(
        default=None, pattern=r"^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$"
    )
    footer_text_color: str | None = Field(
        default=None, pattern=r"^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$"
    )
    hero_text_color: str | None = Field(
        default=None, pattern=r"^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$"
    )
    hero_muted_text_color: str | None = Field(
        default=None, pattern=r"^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$"
    )
    allow_user_self_customization: bool | None = None
    menu_style: Literal["pill", "accordion", "drawer", "tabs"] | None = None
    allowed_tabs: list[str] = Field(default_factory=list)
    quick_links: list[WorkspacePanelQuickLink] = Field(default_factory=list)
    icon: str | None = Field(default=None, max_length=10)
    accent_color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    secondary_accent_color: str | None = Field(
        default=None, pattern=r"^#[0-9A-Fa-f]{6}$"
    )
    accent_opacity: float | None = Field(default=None, ge=0.2, le=1)
    secondary_accent_opacity: float | None = Field(default=None, ge=0.2, le=1)
    primary_accent_stop: int | None = Field(default=None, ge=20, le=80)
    secondary_accent_start: int | None = Field(default=None, ge=40, le=100)
    glow_intensity: float | None = Field(default=None, ge=0, le=1)


class WorkspacePanelUserOverride(BaseModel):
    user_id: int | None = None
    user_email: str | None = Field(default=None, max_length=255)
    profile_key: str = Field(..., min_length=1, max_length=220)
    note: str | None = Field(default=None, max_length=240)


class WorkspacePanelConfig(BaseModel):
    version: int = 1
    profiles: list[WorkspacePanelProfile] = Field(default_factory=list)
    user_overrides: list[WorkspacePanelUserOverride] = Field(default_factory=list)
