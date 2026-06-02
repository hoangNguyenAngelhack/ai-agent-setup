# Python Patterns

> Best practices for clean, type-safe Python code.

## Type Hints

### Basic Types

```python
# ✅ Use type hints for function signatures
def greet(name: str) -> str:
    return f"Hello, {name}"

def calculate_total(prices: list[float], tax_rate: float = 0.1) -> float:
    subtotal = sum(prices)
    return subtotal * (1 + tax_rate)
```

### Complex Types

```python
from typing import Optional, Union, TypedDict, Literal

# Optional (can be None)
def find_user(user_id: int) -> Optional[User]:
    return db.get(user_id)

# Union (multiple types)
def parse_id(value: Union[str, int]) -> int:
    return int(value)

# Python 3.10+ union syntax
def parse_id(value: str | int) -> int:
    return int(value)

# TypedDict for structured dicts
class UserData(TypedDict):
    id: int
    name: str
    email: str

# Literal for specific values
Status = Literal["pending", "active", "inactive"]
```

### Generics

```python
from typing import TypeVar, Generic

T = TypeVar("T")

class Repository(Generic[T]):
    def __init__(self) -> None:
        self._items: list[T] = []
    
    def add(self, item: T) -> None:
        self._items.append(item)
    
    def get_all(self) -> list[T]:
        return self._items.copy()

# Usage
user_repo: Repository[User] = Repository()
```

---

## Dataclasses

### Basic Dataclass

```python
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class User:
    id: int
    email: str
    name: str
    created_at: datetime = field(default_factory=datetime.now)
    is_active: bool = True
```

### Immutable Dataclass

```python
@dataclass(frozen=True)
class Config:
    api_url: str
    timeout: int
    debug: bool = False
```

### Dataclass with Validation

```python
@dataclass
class User:
    email: str
    age: int
    
    def __post_init__(self) -> None:
        if "@" not in self.email:
            raise ValueError("Invalid email")
        if self.age < 0:
            raise ValueError("Age cannot be negative")
```

---

## Pydantic (Recommended for APIs)

```python
from pydantic import BaseModel, EmailStr, Field, validator

class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=100)
    age: int = Field(ge=0, le=150)
    
    @validator("name")
    def name_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    
    class Config:
        from_attributes = True  # Enable ORM mode
```

---

## Async Patterns

### Async Functions

```python
import asyncio
from typing import Coroutine

async def fetch_user(user_id: int) -> User:
    async with httpx.AsyncClient() as client:
        response = await client.get(f"/users/{user_id}")
        return User(**response.json())

async def fetch_users(user_ids: list[int]) -> list[User]:
    tasks = [fetch_user(uid) for uid in user_ids]
    return await asyncio.gather(*tasks)
```

### Context Managers

```python
from contextlib import asynccontextmanager
from typing import AsyncIterator

@asynccontextmanager
async def get_db_session() -> AsyncIterator[AsyncSession]:
    session = AsyncSession()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()

# Usage
async with get_db_session() as session:
    await session.execute(query)
```

---

## Error Handling

### Custom Exceptions

```python
class AppError(Exception):
    def __init__(self, message: str, code: str = "INTERNAL_ERROR"):
        self.message = message
        self.code = code
        super().__init__(self.message)

class NotFoundError(AppError):
    def __init__(self, resource: str, id: int | str):
        super().__init__(f"{resource} with id {id} not found", "NOT_FOUND")

class ValidationError(AppError):
    def __init__(self, field: str, message: str):
        self.field = field
        super().__init__(message, "VALIDATION_ERROR")
```

### Result Pattern (Alternative to Exceptions)

```python
from dataclasses import dataclass
from typing import Generic, TypeVar

T = TypeVar("T")
E = TypeVar("E")

@dataclass
class Ok(Generic[T]):
    value: T

@dataclass
class Err(Generic[E]):
    error: E

Result = Ok[T] | Err[E]

def divide(a: float, b: float) -> Result[float, str]:
    if b == 0:
        return Err("Cannot divide by zero")
    return Ok(a / b)
```

---

## Code Organization

### Module Structure

```
myproject/
├── __init__.py
├── main.py
├── config.py
├── models/
│   ├── __init__.py
│   ├── user.py
│   └── post.py
├── services/
│   ├── __init__.py
│   ├── user_service.py
│   └── email_service.py
├── repositories/
│   ├── __init__.py
│   └── user_repository.py
└── utils/
    ├── __init__.py
    └── helpers.py
```

### Dependency Injection

```python
from typing import Protocol

class EmailService(Protocol):
    def send(self, to: str, subject: str, body: str) -> None: ...

class UserService:
    def __init__(self, email_service: EmailService) -> None:
        self._email = email_service
    
    def register(self, email: str, name: str) -> User:
        user = User(email=email, name=name)
        self._email.send(email, "Welcome!", f"Hi {name}")
        return user
```

---

## Anti-Patterns to Avoid

### Don't Use Mutable Default Arguments

```python
# ❌ Bad - mutable default
def add_item(item: str, items: list[str] = []) -> list[str]:
    items.append(item)
    return items

# ✅ Good
def add_item(item: str, items: list[str] | None = None) -> list[str]:
    if items is None:
        items = []
    items.append(item)
    return items
```

### Don't Use Bare `except`

```python
# ❌ Bad
try:
    do_something()
except:
    pass

# ✅ Good
try:
    do_something()
except ValueError as e:
    logger.error(f"Validation error: {e}")
except Exception as e:
    logger.exception("Unexpected error")
    raise
```

### Don't Use `type()` for Type Checking

```python
# ❌ Bad
if type(x) == list:
    pass

# ✅ Good
if isinstance(x, list):
    pass
```

### Don't Ignore Type Errors

```python
# ❌ Bad
result = some_function()  # type: ignore

# ✅ Better - fix the issue or explain
result: ExpectedType = some_function()  # type: ignore[return-value]  # Library bug #123
```

---

## PEP 8 Essentials

### Naming

```python
# Variables and functions: snake_case
user_count = 10
def get_user_by_id(user_id: int) -> User: ...

# Classes: PascalCase
class UserRepository: ...

# Constants: UPPER_SNAKE_CASE
MAX_RETRIES = 3
DEFAULT_TIMEOUT = 30

# Private: prefix with underscore
_internal_cache: dict[str, Any] = {}
def _helper_function() -> None: ...
```

### Line Length

- Max 88 characters (Black default)
- Max 79 for comments and docstrings

### Imports

```python
# Standard library
import os
import sys
from datetime import datetime

# Third-party
import httpx
from fastapi import FastAPI
from pydantic import BaseModel

# Local
from myproject.models import User
from myproject.services import UserService
```
