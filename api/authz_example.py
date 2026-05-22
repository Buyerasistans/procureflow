# Kullanıcıya sadece yetkili olduğu departman/iş/görevlerin gösterilmesi için örnek FastAPI endpoint
from fastapi import APIRouter, Depends

router = APIRouter()


def get_current_user():
    # TODO: Gerçek kullanıcı doğrulama
    return {"id": 1, "authorized_departments": [1, 2], "authorized_jobs": [1, 2, 3]}


@router.get("/my/departments", tags=["auth"])
def get_my_departments(user=Depends(get_current_user)):
    # TODO: Sadece yetkili olduğu departmanları döndür
    return {"departments": user["authorized_departments"]}


@router.get("/my/jobs", tags=["auth"])
def get_my_jobs(user=Depends(get_current_user)):
    # TODO: Sadece yetkili olduğu işleri döndür
    return {"jobs": user["authorized_jobs"]}
