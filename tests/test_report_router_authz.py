from datetime import datetime, UTC

from api.core.security import create_access_token, get_password_hash
from api.database import SessionLocal
from api.models.project import Project
from api.models.quote import Quote
from api.models.user import User


def test_report_endpoints_forbid_unrelated_member_but_allow_quote_creator(client):
    db = SessionLocal()
    try:
        creator = User(
            email="report-creator@test.local",
            hashed_password=get_password_hash("Report123!"),
            full_name="Report Creator",
            role="user",
            system_role="tenant_member",
            is_active=True,
        )
        outsider = User(
            email="report-outsider@test.local",
            hashed_password=get_password_hash("Report123!"),
            full_name="Report Outsider",
            role="user",
            system_role="tenant_member",
            is_active=True,
        )
        project = Project(
            name="Report Auth Project",
            code="REPORT-AUTH-1",
            description="report authz test",
            is_active=True,
            project_type="merkez",
        )
        db.add_all([creator, outsider, project])
        db.flush()

        quote = Quote(
            user_id=creator.id,
            created_by_id=creator.id,
            project_id=project.id,
            title="Report Auth Quote",
            description="authz coverage",
            company_name="ACME",
            company_contact_name="ACME Contact",
            company_contact_phone="+90 555 000 00 00",
            company_contact_email="acme@test.local",
            total_amount=1000,
            amount=1000,
            currency="TRY",
            created_at=datetime.now(UTC),
        )
        db.add(quote)
        db.commit()
        db.refresh(creator)
        db.refresh(outsider)
        db.refresh(quote)

        creator_token = client.post(
            "/api/v1/auth/login",
            json={"email": "report-creator@test.local", "password": "Report123!"},
        )
        outsider_token = client.post(
            "/api/v1/auth/login",
            json={"email": "report-outsider@test.local", "password": "Report123!"},
        )

        if creator_token.status_code != 200 or outsider_token.status_code != 200:
            creator_headers = {
                "Authorization": f"Bearer {create_access_token(str(creator.id), creator.role, creator.system_role)}"
            }
            outsider_headers = {
                "Authorization": f"Bearer {create_access_token(str(outsider.id), outsider.role, outsider.system_role)}"
            }
        else:
            creator_headers = {
                "Authorization": f"Bearer {creator_token.json()['access_token']}"
            }
            outsider_headers = {
                "Authorization": f"Bearer {outsider_token.json()['access_token']}"
            }

        forbidden_comparison = client.get(
            f"/api/v1/reports/{quote.id}/comparison", headers=outsider_headers
        )
        forbidden_detailed = client.get(
            f"/api/v1/reports/{quote.id}/comparison/detailed", headers=outsider_headers
        )
        forbidden_export = client.get(
            f"/api/v1/reports/{quote.id}/comparison/export-xlsx",
            headers=outsider_headers,
        )

        assert forbidden_comparison.status_code == 403, forbidden_comparison.text
        assert forbidden_detailed.status_code == 403, forbidden_detailed.text
        assert forbidden_export.status_code == 403, forbidden_export.text

        allowed = client.get(
            f"/api/v1/reports/{quote.id}/comparison", headers=creator_headers
        )
        assert allowed.status_code in (200, 404), allowed.text

        allowed_detailed = client.get(
            f"/api/v1/reports/{quote.id}/comparison/detailed",
            headers=creator_headers,
        )
        if allowed_detailed.status_code == 200:
            assert allowed_detailed.json()["quote"]["rfq_id"] == quote.id
    finally:
        db.query(Quote).filter(Quote.title == "Report Auth Quote").delete(
            synchronize_session=False
        )
        db.query(User).filter(
            User.email.in_(["report-creator@test.local", "report-outsider@test.local"])
        ).delete(synchronize_session=False)
        db.query(Project).filter(Project.code == "REPORT-AUTH-1").delete(
            synchronize_session=False
        )
        db.commit()
        db.close()
