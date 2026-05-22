# api/models/bom.py

from sqlalchemy import Column, String, Float, ForeignKey, Integer
from api.database import Base


class Recipe(Base):
    __tablename__ = "recipes"
    id = Column(Integer, primary_key=True)
    layer_name = Column(String, unique=True, index=True)  # Örn: PF_DUVAR_ALCIPAN
    description = Column(String)


class RecipeItem(Base):
    __tablename__ = "recipe_items"
    id = Column(Integer, primary_key=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"))
    material_name = Column(String)  # Örn: Alçıpan Levha 12.5mm
    consumption_rate = Column(Float)  # Sarfiyat katsayısı (Örn: 1.05 m2/m2)
    unit = Column(String)  # Örn: m2, kg, adet
