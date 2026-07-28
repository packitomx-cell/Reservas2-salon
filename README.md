# Reservas — Salón del Reino, San Ysidro, CA

## 1. Ajustar las reglas de Firestore (importante)

El modo de prueba de Firestore deja de funcionar en 30 días. Para que la app
siga funcionando después, entra a Firebase Console → Firestore Database →
pestaña **Reglas**, y reemplaza el contenido por:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

Esto deja la base de datos abierta (sin necesidad de que la gente inicie
sesión), igual que el resto de esta app. Cualquiera con el enlace puede ver y
editar el horario.

## 2. Subir el código a GitHub

1. Crea una cuenta en github.com si no tienes una.
2. Crea un repositorio nuevo (público o privado, ambos sirven), por ejemplo
   `reservas-salon-reino`.
3. Sube todos estos archivos a ese repositorio (puedes arrastrar la carpeta
   completa desde la página de GitHub con "uploading an existing file", o usar
   git desde la terminal).

## 3. Publicar en Vercel

1. Crea una cuenta gratuita en vercel.com (puedes entrar con tu cuenta de
   GitHub directamente).
2. Toca "Add New… → Project" e importa el repositorio que acabas de subir.
3. Vercel detecta automáticamente que es un proyecto Vite — deja todo con los
   valores por defecto y toca "Deploy".
4. En un par de minutos te da una dirección como
   `reservas-salon-reino.vercel.app`. Esa es tu app, ya real y pública.

## 4. Instalarla como app en el celular

Abre esa dirección desde Chrome (Android) o Safari (iPhone) y usa la opción
"Agregar a pantalla de inicio". Va a aparecer con su propio ícono, como una
app normal.
