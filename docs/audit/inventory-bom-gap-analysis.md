# ChopLife Republic — Inventory Category Hierarchy & BOM Gap Analysis

**Date**: October 22, 2026  

---

## 1. Standard 14-Tier Inventory Classification

1. **Saleable Menu Products**: Prepared dishes, combos, bread loaves.
2. **Raw Meat & Poultry**: Chicken drumsticks, beef, goat meat, turkey wings, catfish.
3. **Rice & Grains**: Nigerian parboiled long grain rice, beans, cornmeal.
4. **Oils & Fats**: Refined vegetable oil, red palm oil, margarine, butter.
5. **Fresh Produce & Vegetables**: Habanero peppers, tomatoes, onions, ginger, garlic, veggies.
6. **Bakery Inputs**: Premium baker flour, yeast, sugar, salt, baking powder, milk powder.
7. **Spices & Seasonings**: Suya pepper mix, curry, thyme, bouillon cubes, crayfish powder.
8. **Beverages & Concentrates**: Zobo leaves, Chapman syrup, fruit juices, beer, sodas.
9. **Takeaway Packaging & Disposables**: Bento boxes, foil containers, paper bags, napkins, cutlery.
10. **Catering Consumables**: Sterno heating fuel cans, chafing dish foil inserts, Cambro liners.
11. **Cleaning & Sanitation**: Dishwashing liquid, bleach, hand sanitizer, mop heads, trash bags.
12. **Kitchen Tools & Utensils**: Tongs, chef knives, spatulas, cutting boards, ladles.
13. **Equipment & Machinery**: Deep fryers, ovens, dough mixers, blenders, freezers.
14. **Uniforms & Wearables**: Chef jackets, aprons, hair nets, disposable gloves.

---

## 2. Recipe & BOM Coverage Analysis

- **Verified Recipe Links**: 100% of core menu items (Asun Jollof Rice, Suya Platters, Meat Pies, Sardine Bread Loaves, Grilled Catfish) are mapped to raw ingredient SKUs.
- **Wastage Ledger Integration**: Spoilage or prep loss is recorded with item name, quantity, category, reason, and estimated monetary loss value in `db.wastage`.
