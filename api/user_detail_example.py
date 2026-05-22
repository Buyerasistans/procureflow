from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict

router = APIRouter()

# Mock database (gerçek DB ile değiştirilmeli)
departments_db = {
    1: {"id": 1, "name": "Satın Alma"},
    2: {"id": 2, "name": "Finans"},
}
jobs_db = {
    1: {"id": 1, "department_id": 1, "name": "Teklif Hazırlama"},
    2: {"id": 2, "department_id": 2, "name": "Satın Alma"},
    3: {"id": 3, "department_id": 1, "name": "Onay"},
}
users_db = {
    1: {"id": 1, "name": "Ali Veli", "email": "ali@firma.com"},
    2: {"id": 2, "name": "Ayşe Kaya", "email": "ayse@firma.com"},
}
department_user_db = [
    {"user_id": 1, "department_id": 1},
    {"user_id": 1, "department_id": 2},
    {"user_id": 2, "department_id": 1},
]
user_job_db = [
    {"user_id": 1, "job_id": 1},
    {"user_id": 1, "job_id": 2},
    {"user_id": 2, "job_id": 3},
]


class UserDetailResponse(BaseModel):
    id: int
    name: str
    email: str
    departments: List[Dict]
    jobs: List[Dict]


@router.get(
    "/users/{user_id}/detail", response_model=UserDetailResponse, tags=["users"]
)
def get_user_detail(user_id: int):
    user = users_db.get(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı."
        )
    # Kullanıcının departmanları
    user_departments = [
        departments_db[dud["department_id"]]
        for dud in department_user_db
        if dud["user_id"] == user_id
    ]
    # Kullanıcının işleri
    user_jobs = [
        jobs_db[ujd["job_id"]] for ujd in user_job_db if ujd["user_id"] == user_id
    ]
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "departments": user_departments,
        "jobs": user_jobs,
    }
