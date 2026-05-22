from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import List

router = APIRouter()

# Mock database (gerçek DB ile değiştirilmeli)
users_db = {
    1: {"id": 1, "name": "Ali Veli", "roles": ["Yönetici"]},
    2: {"id": 2, "name": "Ayşe Kaya", "roles": ["Satın Almacı"]},
    3: {"id": 3, "name": "Mehmet Demir", "roles": []},
}


# Simüle edilen kullanıcı kimliği (gerçek sistemde JWT/Session ile alınır)
def get_current_user_id():
    return 3  # Örnek: Mehmet Demir'in hiç yetkisi yok


class ActionResponse(BaseModel):
    allowed: bool
    message: str


@router.get(
    "/actions/can-edit-department", response_model=ActionResponse, tags=["authz"]
)
def can_edit_department(current_user_id: int = Depends(get_current_user_id)):
    user = users_db.get(current_user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Kullanıcı bulunamadı."
        )
    if "Yönetici" in user["roles"]:
        return {"allowed": True, "message": "İşlem yapılabilir."}
    return {"allowed": False, "message": "Yetkiniz yok, işlem arayüzde gizlenmeli."}
