import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'willkommen',
    pathMatch: 'full',
  },
  {
    path: 'willkommen',
    loadComponent: () => import('./components/bienvenida/bienvenida.component').then(m => m.BienvenidaComponent),
  },
  {
    path: 'traumdeutung',
    loadComponent: () => import('./components/significado-suenos/significado-suenos.component').then(m => m.SignificadoSuenosComponent),
  },
  {
    path: 'sternzeichen-informationen',
    loadComponent: () => import('./components/informacion-zodiaco/informacion-zodiaco.component').then(m => m.InformacionZodiacoComponent),
  },
  {
    path: 'numerologie-lesung',
    loadComponent: () => import('./components/lectura-numerologia/lectura-numerologia.component').then(m => m.LecturaNumerologiaComponent),
  },
  {
    path: 'berufskarte',
    loadComponent: () => import('./components/mapa-vocacional/mapa-vocacional.component').then(m => m.MapaVocacionalComponent),
  },
  {
    path: 'inneres-tier',
    loadComponent: () => import('./components/animal-interior/animal-interior.component').then(m => m.AnimalInteriorComponent),
  },
  {
    path: 'geburtstabelle',
    loadComponent: () => import('./components/tabla-nacimiento/tabla-nacimiento.component').then(m => m.TablaNacimientoComponent),
  },
  {
    path: 'horoskop',
    loadComponent: () => import('./components/zodiaco-chino/zodiaco-chino.component').then(m => m.ZodiacoChinoComponent),
  },
  {
    path: 'liebesrechner',
    loadComponent: () => import('./components/calculadora-amor/calculadora-amor.component').then(m => m.CalculadoraAmorComponent),
  },
  {
    path: 'partikel',
    loadComponent: () => import('./shared/particles/particles.component').then(m => m.ParticlesComponent),
  },
  {
    path: 'nutzungsbedingungen-ecos',
    loadComponent: () => import('./components/terminos-condiciones/terminos-condiciones.component').then(m => m.TerminosCondicionesEcos),
  },
  {
    path: 'cookie-richtlinien',
    loadComponent: () => import('./components/cookies/cookies.component').then(m => m.CookiesComponent),
  },
];