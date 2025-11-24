<h1 align="center">Validation JSON Builder 🧩</h1>

<p align="center">
  A visual builder for JSON validation configs with <strong>Patterns</strong>, <strong>ObjectTypes</strong>, wildcard paths, and full editing support.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/MUI-v5-007FFF?logo=mui&logoColor=white" />
  <img src="https://img.shields.io/badge/Status-Experimental-orange" />
</p>

---

## 📸 Screenshots

> Replace the image files under `docs/screenshots/` with your real screenshots.

### Main Screen – From JSON to Validation

<p align="center">
  <img src="docs/main-builder.png" alt="Validation JSON Builder main UI" width="900" />
</p>

### ObjectTypes Editor

<p align="center">
  <img src="docs/screenshots/object-types.png" alt="ObjectTypes editor" width="900" />
</p>

### Load & Edit Existing Validation JSON

<p align="center">
  <img src="docs/screenshots/load-existing.png" alt="Load existing validation JSON" width="900" />
</p>

---

## 🚀 Overview

This project is a React-based interactive tool for building **Validation JSON configuration files**.

The generated structure looks like:

```json
{
  "Validation": {
    "Patterns": {
      "AlphaNumeric": "regex:^[A-Za-z0-9]+$",
      "Email": "regex:^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$"
    },
    "ObjectTypes": {
      "Role": {
        "name": { "Required": true },
        "permissions[*]": { "Required": true }
      }
    },
    "Types": {
      "MyDto": {
        "currentUser.roles[*]": {
          "Required": true,
          "ObjectType": "Role"
        },
        "system.name": {
          "Required": true,
          "PatternKey": "AlphaNumeric",
          "MinLength": 1,
          "MaxLength": 60
        }
      }
    }
  }
}
