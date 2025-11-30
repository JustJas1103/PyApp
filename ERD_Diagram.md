# Entity Relationship Diagram (ERD)
## AI-Powered Filipino Recipe Recommender System
### Crow's Foot Notation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ENTITY RELATIONSHIP DIAGRAM                              │
│              PinoyLuto AI Recipe Recommender System                          │
└─────────────────────────────────────────────────────────────────────────────┘


┌──────────────────────┐
│      USER            │
│──────────────────────│
│ user_id (PK)         │
│ session_id           │
│ created_at           │
│ last_active          │
└──────────────────────┘
         │
         │ 1
         │
         │ uploads/captures
         │
         ○< M
         │
┌──────────────────────┐
│   IMAGE_UPLOAD       │
│──────────────────────│
│ image_id (PK)        │
│ user_id (FK)         │
│ image_path           │
│ image_data           │
│ upload_timestamp     │
│ source_type          │ (camera/upload)
└──────────────────────┘
         │
         │ 1
         │
         │ analyzed_by
         │
         ○< M
         │
┌──────────────────────┐
│    DETECTION         │
│──────────────────────│
│ detection_id (PK)    │
│ image_id (FK)        │
│ ingredient_id (FK)   │
│ confidence           │
│ bounding_box_x       │
│ bounding_box_y       │
│ bounding_box_width   │
│ bounding_box_height  │
│ detected_at          │
└──────────────────────┘
         │                    ┌──────────────────────┐
         │ M                  │   ROBOFLOW_API       │
         │                    │──────────────────────│
         │ identifies         │ api_key              │
         │                    │ api_url              │
         ○>────────────────○  │ model_version        │
         │ 1                  │ confidence_threshold │
         │                    └──────────────────────┘
         │
┌──────────────────────┐
│    INGREDIENT        │
│──────────────────────│
│ ingredient_id (PK)   │
│ ingredient_name      │
│ category             │
│ is_common            │
└──────────────────────┘
         │
         │ M
         │
         │ used_in
         │
         ○< M (Many-to-Many via RECIPE_INGREDIENT)
         │
┌──────────────────────┐
│ RECIPE_INGREDIENT    │
│──────────────────────│
│ recipe_id (FK, PK)   │
│ ingredient_id (FK,PK)│
│ quantity             │
│ unit                 │
│ is_required          │
└──────────────────────┘
         │
         │ M
         │
         │ belongs_to
         │
         ○> 1
         │
┌──────────────────────┐
│       RECIPE         │
│──────────────────────│
│ recipe_id (PK)       │
│ recipe_name          │
│ description          │
│ image_emoji          │
│ time_required        │
│ servings             │
│ difficulty           │
│ instructions         │
│ cuisine_type         │
│ created_at           │
│ updated_at           │
└──────────────────────┘
         │
         │ 1
         │
         │ has
         │
         ○< 1
         │
┌──────────────────────┐
│  NUTRITION_INFO      │
│──────────────────────│
│ nutrition_id (PK)    │
│ recipe_id (FK)       │
│ calories             │
│ protein              │
│ carbohydrates        │
│ fat                  │
│ fiber                │
│ sodium               │
│ serving_size         │
└──────────────────────┘


┌──────────────────────┐              ┌──────────────────────┐
│       RECIPE         │              │    USER_BASKET       │
│──────────────────────│              │──────────────────────│
│ recipe_id (PK)       │ ─┐           │ basket_id (PK)       │
│ recipe_name          │  │           │ user_id (FK)         │
│ ...                  │  │           │ created_at           │
└──────────────────────┘  │           └──────────────────────┘
         │                │                     │
         │ 1              │                     │ 1
         │                │                     │
         │ matched_with   │                     │ contains
         │                │                     │
         ○< M             │                     ○< M
         │                │                     │
┌──────────────────────┐  │           ┌──────────────────────┐
│ RECIPE_RECOMMENDATION│  │           │   BASKET_ITEM        │
│──────────────────────│  │           │──────────────────────│
│ recommendation_id(PK)│  │           │ basket_item_id (PK)  │
│ user_id (FK)         │  │           │ basket_id (FK)       │
│ recipe_id (FK)       │◄─┘           │ ingredient_id (FK)   │
│ match_percentage     │               │ added_at             │
│ matched_count        │               │ source               │ (detected/manual)
│ total_count          │               └──────────────────────┘
│ recommended_at       │                         │
│ user_clicked         │                         │ M
└──────────────────────┘                         │
         │                                       │ references
         │ M                                     │
         │                                       ○> 1
         │ viewed_by                             │
         │                                       │
         ○> 1                            ┌──────────────────────┐
         │                               │    INGREDIENT        │
┌──────────────────────┐                 │──────────────────────│
│      USER            │                 │ ingredient_id (PK)   │
│──────────────────────│ ───────────────>│ ingredient_name      │
│ user_id (PK)         │ 1          M    │ ...                  │
│ ...                  │ adds_to_fav     └──────────────────────┘
└──────────────────────┘
         │
         │ 1
         │
         │ saves
         │
         ○< M
         │
┌──────────────────────┐
│   USER_FAVORITE      │
│──────────────────────│
│ favorite_id (PK)     │
│ user_id (FK)         │
│ recipe_id (FK)       │
│ favorited_at         │
└──────────────────────┘
         │
         │ M
         │
         │ references
         │
         ○> 1
         │
┌──────────────────────┐
│       RECIPE         │
│──────────────────────│
│ recipe_id (PK)       │
│ ...                  │
└──────────────────────┘


┌──────────────────────┐
│     ADMIN_USER       │
│──────────────────────│
│ admin_id (PK)        │
│ username             │
│ password_hash        │
│ session_token        │
│ last_login           │
└──────────────────────┘
         │
         │ 1
         │
         │ manages
         │
         ○< M
         │
┌──────────────────────┐
│   RECIPE_AUDIT       │
│──────────────────────│
│ audit_id (PK)        │
│ recipe_id (FK)       │
│ admin_id (FK)        │
│ action_type          │ (CREATE/UPDATE/DELETE)
│ old_values           │
│ new_values           │
│ timestamp            │
└──────────────────────┘
         │
         │ M
         │
         │ tracks_changes_to
         │
         ○> 1
         │
┌──────────────────────┐
│       RECIPE         │
│──────────────────────│
│ recipe_id (PK)       │
│ ...                  │
└──────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                          RELATIONSHIP LEGEND                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Crow's Foot Notation:                                                      │
│    ○< ─── One (mandatory)                                                   │
│    ○> ─── Many (zero or more)                                               │
│    │  ─── Connection line                                                   │
│    1  ─── One side of relationship                                          │
│    M  ─── Many side of relationship                                         │
│                                                                              │
│  Keys:                                                                       │
│    (PK) ─── Primary Key                                                     │
│    (FK) ─── Foreign Key                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## **Entity Descriptions**

### **Core Entities**

1. **USER**
   - Represents app users (tracked via session/localStorage)
   - Can upload images, maintain basket, save favorites

2. **IMAGE_UPLOAD**
   - Stores uploaded/captured images
   - Links to detection results
   - Tracks source (camera vs file upload)

3. **DETECTION**
   - Individual ingredient detections from AI
   - Links image to identified ingredients
   - Includes confidence scores and bounding boxes

4. **INGREDIENT**
   - Master list of all possible ingredients
   - Referenced by detections and recipes

5. **RECIPE**
   - Filipino recipe database (25 recipes)
   - Core entity with instructions, metadata

6. **RECIPE_INGREDIENT** (Junction Table)
   - Many-to-many relationship between recipes and ingredients
   - Stores quantity and unit information

7. **NUTRITION_INFO**
   - One-to-one with Recipe
   - Stores nutritional data per serving

### **Functional Entities**

8. **USER_BASKET**
   - Temporary ingredient collection
   - Accumulates from multiple detections

9. **BASKET_ITEM**
   - Individual ingredients in basket
   - Tracks source (detected or manually added)

10. **RECIPE_RECOMMENDATION**
    - Generated matches based on basket
    - Stores match percentage and counts

11. **USER_FAVORITE**
    - Many-to-many between users and recipes
    - Persisted in localStorage

### **Admin Entities**

12. **ADMIN_USER**
    - Admin authentication
    - Manages recipe CRUD operations

13. **RECIPE_AUDIT**
    - Tracks all recipe changes
    - Logs admin actions (create/update/delete)

### **External API**

14. **ROBOFLOW_API**
    - External AI service configuration
    - Not stored in DB, configuration only

---

## **Key Relationships**

### **Primary Workflows**

1. **Image Detection Flow:**
   ```
   USER → IMAGE_UPLOAD → DETECTION → INGREDIENT
   ```

2. **Recipe Matching Flow:**
   ```
   DETECTION → INGREDIENT → RECIPE_INGREDIENT → RECIPE
   ```

3. **Recommendation Flow:**
   ```
   USER_BASKET → BASKET_ITEM → INGREDIENT → RECIPE_RECOMMENDATION → RECIPE
   ```

4. **Favorites Flow:**
   ```
   USER → USER_FAVORITE → RECIPE
   ```

5. **Admin Management Flow:**
   ```
   ADMIN_USER → RECIPE_AUDIT → RECIPE
   ```

---

## **Cardinality Summary**

| Relationship | Cardinality | Description |
|-------------|-------------|-------------|
| USER → IMAGE_UPLOAD | 1:M | One user uploads many images |
| IMAGE_UPLOAD → DETECTION | 1:M | One image has many detections |
| DETECTION → INGREDIENT | M:1 | Many detections identify one ingredient |
| RECIPE ↔ INGREDIENT | M:M | Many recipes use many ingredients (via junction) |
| RECIPE → NUTRITION_INFO | 1:1 | One recipe has one nutrition info |
| USER → USER_BASKET | 1:1 | One user has one active basket |
| USER_BASKET → BASKET_ITEM | 1:M | One basket contains many items |
| USER → USER_FAVORITE | 1:M | One user has many favorites |
| USER_FAVORITE → RECIPE | M:1 | Many favorites reference one recipe |
| ADMIN_USER → RECIPE_AUDIT | 1:M | One admin creates many audit logs |
| RECIPE_AUDIT → RECIPE | M:1 | Many audits track one recipe |

---

## **Implementation Notes**

### **Current Storage:**
- **Backend:** JSON file (`recipes.json`) for recipe data
- **Frontend:** localStorage for user data (basket, favorites)
- **Session:** Flask sessions for admin authentication
- **Temporary:** File system for uploaded images

### **Scalability Considerations:**
This ERD represents the **logical data model**. For production:
- Migrate from JSON to relational database (PostgreSQL/MySQL)
- Implement proper user authentication
- Add caching layer (Redis) for recommendations
- Store images in cloud storage (S3/Cloudinary)
- Add analytics tables for usage tracking

---

## **Business Rules**

1. A recipe must have at least one ingredient
2. Nutrition info is optional but recommended
3. Detection confidence must exceed threshold (40%)
4. Match percentage = (matched ingredients / total ingredients) × 100
5. Favorites persist across sessions via localStorage
6. Admin actions are logged for audit trail
7. Images are temporary and can be purged periodically
8. Basket accumulates ingredients from multiple detections

