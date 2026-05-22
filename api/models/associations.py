# models/associations.py
"""Association tables for many-to-many relationships"""

from sqlalchemy import Table, Column, Integer, ForeignKey
from api.database import Base

# User-Company M2M
user_company = Table(
    "user_company",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("company_id", Integer, ForeignKey("companies.id"), primary_key=True),
)

# User-Department M2M (user can have specific role in department at company)
user_department = Table(
    "user_department",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("department_id", Integer, ForeignKey("departments.id"), primary_key=True),
)

# Company-Department M2M (which departments operate in which companies)
company_department = Table(
    "company_department",
    Base.metadata,
    Column("company_id", Integer, ForeignKey("companies.id"), primary_key=True),
    Column("department_id", Integer, ForeignKey("departments.id"), primary_key=True),
)

# User-Manager M2M (personel which managers/superiors they report to)
user_managers = Table(
    "user_managers",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("manager_id", Integer, ForeignKey("users.id"), primary_key=True),
)

# User-Company-Role M2M (which roles user has in which companies)
user_company_roles = Table(
    "user_company_roles",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("company_id", Integer, ForeignKey("companies.id"), primary_key=True),
    Column("role_id", Integer, ForeignKey("roles.id"), primary_key=True),
)

# User-Project-Permission M2M (project based permissions)
user_project_permissions = Table(
    "user_project_permissions",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("project_id", Integer, ForeignKey("projects.id"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id"), primary_key=True),
)
