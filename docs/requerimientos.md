### Plan de Desarrollo: Plataforma Web de Presupuestos BIM

**Stack Tecnológico Confirmado:**

* **Frontend**: **React** (usando **Vite** para el setup)  
* **Librería 3D**: **@thatopencompany/components** (basada en IFC.js)  
* **Estilos**: **Tailwind CSS** (con **shadcn/ui** o **Headless UI** para componentes base)  
* **Backend**: **FastAPI** (Python)  
* **Base de Datos**: **PostgreSQL**  
* **ORM**: **SQLAlchemy** (para conectar FastAPI con PostgreSQL)

#### 1\. Arquitectura y Flujo de Datos

La aplicación será una **SPA (Single Page Application)** construida con React.

* **Procesamiento del IFC (Frontend)**: La carga, visualización y extracción de datos del archivo IFC se realizarán **100% en el navegador (cliente)** usando la librería @thatopencompany/components. Esto reduce la carga del servidor y hace la experiencia 3D muy rápida.  
* **API del Backend (FastAPI)**: El servidor FastAPI expondrá una **API RESTful** que se encargará exclusivamente de la lógica de negocio: gestión del catálogo de precios, guardado de proyectos y usuarios.  
* **Estado del Frontend (React)**: Se utilizará un gestor de estado como **Zustand** o **Redux Toolkit** para manejar de forma global la información crítica: el modelo BIM cargado, el elemento 3D seleccionado y los datos del presupuesto actual.  
* **Base de Datos (PostgreSQL)**: Almacenará dos tablas principales: line\_items (el catálogo de precios unitarios) y projects (los presupuestos guardados por los usuarios).

#### 2\. Modelos de Datos (PostgreSQL & Pydantic)

Esta es la estructura base para la base de datos y la validación en FastAPI.

**Tabla line\_items en PostgreSQL:**

CREATE TABLE line\_items (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    code VARCHAR(50) UNIQUE,  
    description TEXT NOT NULL,  
    unit VARCHAR(10) NOT NULL, \-- ej: m3, m2, kg, und  
    unit\_price NUMERIC(12, 2\) NOT NULL,  
    created\_at TIMESTAMPTZ DEFAULT now(),  
    updated\_at TIMESTAMPTZ DEFAULT now()  
);

**Modelo Pydantic correspondiente en FastAPI:**

from pydantic import BaseModel  
from uuid import UUID

class LineItemBase(BaseModel):  
    code: str | None \= None  
    description: str  
    unit: str  
    unit\_price: float

class LineItem(LineItemBase):  
    id: UUID

    class Config:  
        from\_attributes \= True

#### 3\. Fases de Desarrollo (Roadmap Técnico)

##### Fase 1: Configuración y Visor 3D Básico **🏗️**

* **Objetivo**: Montar un visor IFC funcional.  
* **Tareas**:  
  1. Inicializar el proyecto frontend con npm create vite@latest \-- \--template react-ts.  
  2. Configurar **Tailwind CSS** para el estilizado.  
  3. Instalar e integrar @thatopencompany/components.  
  4. Crear un componente React \<BimViewer /\> que contenga la lógica de carga del IFC y la visualización 3D.  
  5. Implementar un componente \<Toolbar /\> con los controles básicos (cargar archivo, zoom, etc.).

##### Fase 2: Interacción 3D y Paneles de Datos **👆**

* **Objetivo**: Conectar el modelo 3D con la interfaz de usuario.  
* **Tareas**:  
  1. Configurar un **store de Zustand** para manejar el estado global, incluyendo selectedElementId.  
  2. Implementar el evento onHighlight del visor para que, al seleccionar un elemento, su expressID se guarde en el store de Zustand.  
  3. Crear un componente React \<PropertiesPanel /\> que se suscriba a los cambios de selectedElementId en Zustand.  
  4. Cuando selectedElementId cambie, el \<PropertiesPanel /\> usará las funciones de @thatopencompany/components para obtener y renderizar las propiedades y cantidades del elemento.

##### Fase 3: Backend para Precios y Presupuesto **⚙️**

* **Objetivo**: Crear el servicio que gestionará el catálogo de precios.  
* **Tareas**:  
  1. Inicializar el proyecto **FastAPI**.  
  2. Configurar la conexión a **PostgreSQL** usando **SQLAlchemy** como ORM.  
  3. Crear el modelo SQLAlchemy para la tabla line\_items.  
  4. Desarrollar los **endpoints de la API REST** para el **CRUD** (Crear, Leer, Actualizar, Borrar) de las partidas en /api/v1/line-items.  
  5. Asegurar la API con la documentación automática de Swagger UI que provee FastAPI.

##### Fase 4: Integración Frontend-Backend y Lógica de Presupuesto **💰**

* **Objetivo**: Conectar la interfaz con el backend y construir la tabla del presupuesto.  
* **Tareas**:  
  1. En React, usar axios o fetch para consumir los endpoints de la API de FastAPI.  
  2. Crear el componente \<BudgetTable /\> en React.  
  3. Implementar la funcionalidad **"Añadir a Presupuesto"**:  
     * Al hacer clic, tomará las mediciones del \<PropertiesPanel /\>.  
     * Abrirá un modal donde el usuario podrá buscar y seleccionar una partida desde el catálogo obtenido de la API (/api/v1/line-items).  
     * La fila se añadirá a la tabla del presupuesto.  
  4. Toda la lógica de la tabla (cálculos de subtotales, edición de celdas) se manejará en el estado del frontend.

##### Fase 5: Guardado de Proyectos y Exportación **📄**

* **Objetivo**: Finalizar la funcionalidad principal y añadir utilidades.  
* **Tareas**:  
  1. En FastAPI, crear los endpoints /api/v1/projects para **guardar y cargar** el estado de un presupuesto (un JSON con las filas de la tabla) en la base de datos PostgreSQL.  
  2. En React, añadir los botones de "Guardar" y "Cargar Proyecto", que interactuarán con los nuevos endpoints.  
  3. Implementar la **exportación a Excel (XLSX)** directamente en el frontend. Se puede usar la librería sheetjs.  
  4. Implementar filtros visuales en el 3D usando las capacidades de @thatopencompany/components para ocultar o aislar elementos por categoría o piso.