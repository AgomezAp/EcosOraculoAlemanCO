# 🗺️ Rutas de Angular para PayPal - Ecos del Oráculo (Alemán)

## 📋 Tabla de Rutas por Servicio

Tu aplicación usa rutas en **ALEMÁN**. Usa estas rutas exactas en `returnPath` y `cancelPath`:

| Servicio (Español) | Ruta Angular (Alemán) | Componente |
|-------------------|----------------------|------------|
| Bienvenida | `/willkommen` | BienvenidaComponent |
| **Mapa Vocacional** | **`/berufskarte`** | MapaVocacionalComponent |
| Significado de Sueños | `/traumdeutung` | SignificadoSuenosComponent |
| Información Zodíaco | `/zodiac-information` | InformacionZodiacoComponent |
| Lectura Numerología | `/numerologie-lesung` | LecturaNumerologiaComponent |
| Animal Interior | `/inneres-tier` | AnimalInteriorComponent |
| Tabla de Nacimiento | `/geburtstabelle` | TablaNacimientoComponent |
| Zodiaco Chino | `/horoskop` | ZodiacoChinoComponent |
| Calculadora de Amor | `/liebesrechner` | CalculadoraAmorComponent |
| Términos y Condiciones | `/nutzungsbedingungen-ecos` | TerminosCondicionesEcos |
| Cookies | `/cookie-richtlinien` | CookiesComponent |

---

## 📝 Configuración de PayPal por Componente

### 1. Berufskarte (Mapa Vocacional) ✅

```typescript
const orderData = {
  amount: '5.00',
  currency: 'USD',
  serviceName: 'Berufskarte',
  returnPath: '/berufskarte',
  cancelPath: '/berufskarte'
};
```

### 2. Traumdeutung (Significado de Sueños)

```typescript
const orderData = {
  amount: '5.00',
  currency: 'USD',
  serviceName: 'Traumdeutung',
  returnPath: '/traumdeutung',
  cancelPath: '/traumdeutung'
};
```

### 3. Numerologie-Lesung (Lectura Numerología)

```typescript
const orderData = {
  amount: '5.00',
  currency: 'USD',
  serviceName: 'Numerologie-Lesung',
  returnPath: '/numerologie-lesung',
  cancelPath: '/numerologie-lesung'
};
```

### 4. Inneres Tier (Animal Interior)

```typescript
const orderData = {
  amount: '5.00',
  currency: 'USD',
  serviceName: 'Inneres Tier',
  returnPath: '/inneres-tier',
  cancelPath: '/inneres-tier'
};
```

### 5. Geburtstabelle (Tabla de Nacimiento)

```typescript
const orderData = {
  amount: '5.00',
  currency: 'USD',
  serviceName: 'Geburtstabelle',
  returnPath: '/geburtstabelle',
  cancelPath: '/geburtstabelle'
};
```

### 6. Horoskop (Zodiaco Chino)

```typescript
const orderData = {
  amount: '5.00',
  currency: 'USD',
  serviceName: 'Chinesisches Horoskop',
  returnPath: '/horoskop',
  cancelPath: '/horoskop'
};
```

### 7. Liebesrechner (Calculadora de Amor)

```typescript
const orderData = {
  amount: '5.00',
  currency: 'USD',
  serviceName: 'Liebesrechner',
  returnPath: '/liebesrechner',
  cancelPath: '/liebesrechner'
};
```

### 8. Zodiac-Information (Información Zodíaco)

```typescript
const orderData = {
  amount: '5.00',
  currency: 'USD',
  serviceName: 'Sternzeichen-Information',
  returnPath: '/zodiac-information',
  cancelPath: '/zodiac-information'
};
```

---

## 🔍 Cómo Verificar la Ruta

Si no estás seguro de la ruta de un componente:

1. Abre `app.routes.ts`
2. Busca el `path` del componente
3. Usa **`/${path}`** en `returnPath` y `cancelPath`

**Ejemplo:**
```typescript
{
  path: 'berufskarte',  // ← Esta es la ruta
  loadComponent: () => import('./components/mapa-vocacional/...'),
}
```
Entonces usa: `returnPath: '/berufskarte'`

---

## ⚠️ Errores Comunes

### ❌ Usar rutas en inglés:
```typescript
returnPath: '/vocational-map'  // ❌ ERROR: No existe
```

### ✅ Usar rutas en alemán:
```typescript
returnPath: '/berufskarte'  // ✅ CORRECTO
```

---

## 🚀 Flujo de Pago Correcto

```
Usuario en: http://localhost:4200/berufskarte
    ↓
Hace clic en "Pagar"
    ↓
PayPal redirige a: http://localhost:3010/api/paypal/capture-order?service=/berufskarte
    ↓
Backend captura pago
    ↓
Backend redirige a: http://localhost:4200/berufskarte?status=COMPLETED&token=JWT
    ↓
Usuario vuelve a la misma página con contenido desbloqueado ✅
```

---

## 📌 Checklist de Migración

Cuando migres un componente a PayPal:

- [ ] Verificar la ruta en `app.routes.ts`
- [ ] Usar la ruta **en alemán** en `returnPath`
- [ ] Usar la ruta **en alemán** en `cancelPath`
- [ ] Configurar `serviceName` en alemán
- [ ] Probar el flujo completo

---

¡Usa siempre las rutas en **ALEMÁN** de esta tabla! 🇩🇪
