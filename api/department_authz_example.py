from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import List

router = APIRouter()

# Mock database (gerçek DB ile değiştirilmeli)
departments_db = {
    1: {"id": 1, "name": "Satın Alma"},
    2: {"id": 2, "name": "Finans"},
}
users_db = {
    1: {"id": 1, "name": "Ali Veli", "email": "ali@firma.com", "department_ids": [1]},
    2: {"id": 2, "name": "Ayşe Kaya", "email": "ayse@firma.com", "department_ids": [2]},
    3: {
        "id": 3,
        "name": "Mehmet Demir",
        "email": "mehmet@firma.com",
        "department_ids": [1, 2],
    },
}


# Simüle edilen kullanıcı kimliği (gerçek sistemde JWT/Session ile alınır)
def get_current_user_id():
    return 1  # Örnek: Ali Veli sadece kendi departmanlarını görebilir


class DepartmentResponse(BaseModel):
    id: int
    name: str


@router.get(
    "/departments/my", response_model=List[DepartmentResponse], tags=["departments"]
)
def get_my_departments(current_user_id: int = Depends(get_current_user_id)):
    user = users_db.get(current_user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Kullanıcı bulunamadı."
        )
    return [
        departments_db[dep_id]
        for dep_id in user["department_ids"]
        if dep_id in departments_db
    ]
