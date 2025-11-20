import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';
import { environment } from '../../environments/environmets.prod';
import { HttpClient } from '@angular/common/http';
import { AnalyticsService } from '../../services/analytics.service';
import { SugerenciasService } from '../../services/sugerencias.service';
import { LoggerService } from '../../services/logger.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-bienvenida',
  imports: [MatIconModule, CommonModule, FormsModule],
  templateUrl: './bienvenida.component.html',
  styleUrl: './bienvenida.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BienvenidaComponent implements AfterViewInit, OnInit {
  @ViewChild('backgroundVideo') backgroundVideo!: ElementRef<HTMLVideoElement>;
  showCookieBanner = false;
  isReturningUser = false;
  userZodiacSign: string | null = null;
  visitCount = 0;
  sessionStartTime: Date = new Date();
  private apiUrl = environment.apiUrl; // Asegúrate de tener esto en tu environment
  sugerenciaTexto: string = '';
  enviandoSugerencia: boolean = false;
  mensajeSugerencia: { texto: string; tipo: 'success' | 'error' } | null = null;
  constructor(
    private router: Router,
    private cookieService: CookieService,
    private http: HttpClient,
    private analyticsService: AnalyticsService,
    private sugerenciasService: SugerenciasService,
    private elRef: ElementRef<HTMLElement>,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef
    ) {}

  ngAfterViewInit() {
    this.startVideo();
    const serviceCards = document.querySelectorAll('.service-card');

    serviceCards.forEach((card) => {
      const video = card.querySelector('.card-video') as HTMLVideoElement;

      if (video) {
        // Precargar el video
        video.load();

        card.addEventListener('mouseenter', async () => {
          try {
            // Intentar reproducir con manejo de promesas
            await video.play();
          } catch (error) {
            // Si falla, intentar con click simulado
            this.logger.log('Autoplay bloqueado, intentando alternativa');
            video.muted = true;
            video.play();
          }
        });

        card.addEventListener('mouseleave', () => {
          video.pause();
          video.currentTime = 0;
        });
      }
    });
      this.setVideosSpeed(0.7);
  }
   private setVideosSpeed(rate: number): void {
    const host = this.elRef.nativeElement;
    const videos = host.querySelectorAll<HTMLVideoElement>('video');
    videos.forEach((v:any) => {
      const apply = () => (v.playbackRate = rate);
      if (v.readyState >= 1) apply();
      else v.addEventListener('loadedmetadata', apply, { once: true });
    });
  }

  ngOnInit() {
    this.sessionStartTime = new Date();
    this.initializeCookies();
  }
  ngOnDestroy() {
    // Enviar analytics al cerrar la sesión
    if (this.cookieService.get('cookieConsent') === 'accepted') {
      this.sendAnalytics();
    }
  }
  async sendAnalytics() {
    try {
      await this.analyticsService.collectAndSendUserAnalytics(
        this.sessionStartTime
      );
    } catch (error) {
      this.logger.error('Error enviando analytics:', error);
    }
  }
  calculateSessionDuration(): number {
    const now = new Date();
    return Math.round((now.getTime() - this.sessionStartTime.getTime()) / 1000); // en segundos
  }

  // ✅ Obtener información del dispositivo
  getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenResolution: `${screen.width}x${screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      cookiesEnabled: navigator.cookieEnabled,
    };
  }
  getBrowserInfo() {
    const ua = navigator.userAgent;
    let browser = 'Unknown';

    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';

    return {
      name: browser,
      version: this.getBrowserVersion(ua),
      mobile: /Mobi|Android/i.test(ua),
    };
  }
  private getBrowserVersion(ua: string): string {
    const match = ua.match(/(Chrome|Firefox|Safari|Edge)\/(\d+)/);
    return match ? match[2] : 'Unknown';
  }
  generateAnonymousId(): string {
    let userId = this.cookieService.get('anonymousUserId');

    if (!userId) {
      userId =
        'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      this.cookieService.set('anonymousUserId', userId, 365);
    }

    return userId;
  }
  trackServicePopularity(serviceName: string) {
    this.analyticsService.trackServicePopularity(serviceName);
  }
  private trackServiceVisit(service: string) {
    this.analyticsService.trackServiceVisit(service);
  }
  // ✅ Actualizar navegateTo para incluir tracking

  private startVideo() {
    if (this.backgroundVideo && this.backgroundVideo.nativeElement) {
      const video = this.backgroundVideo.nativeElement;

      // Asegurar que está silenciado
      video.muted = true;
      video.volume = 0;
      video.playbackRate = 1;
      // Intentar reproducir
      const playPromise = video.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this.logger.log('Video reproduciéndose automáticamente');
          })
          .catch((error:any) => {
            this.logger.log(
              'Autoplay falló, intentando con interacción del usuario:',
              error
            );
            this.setupUserInteractionFallback();
          });
      }
    }
  }

  private setupUserInteractionFallback() {
    const playOnInteraction = () => {
      if (this.backgroundVideo && this.backgroundVideo.nativeElement) {
        this.backgroundVideo.nativeElement.play();
        document.removeEventListener('click', playOnInteraction);
        document.removeEventListener('touchstart', playOnInteraction);
      }
    };

    document.addEventListener('click', playOnInteraction);
    document.addEventListener('touchstart', playOnInteraction);
  }
  initializeCookies() {
    this.logger.info('Iniciando sistema de cookies');

    try {
      const consent = this.cookieService.get('cookieConsent');
      this.showCookieBanner = !consent || consent === '';
      this.logger.log('¿Mostrar banner?', this.showCookieBanner);

      if (consent === 'accepted') {
        this.loadUserData();
        this.personalizeExperience();
        this.trackVisit();
      }
    } catch (error) {
      this.logger.error('Error en initializeCookies:', error);
    }
  }

  forceCreateAppCookies() {
    this.cookieService.set('cookieConsent', 'accepted', 365);
    this.cookieService.set('visitCount', '1', 30);
    this.cookieService.set('lastVisit', new Date().toISOString(), 30);
    this.cookieService.set('userZodiacSign', 'Leo', 365);
  }
  loadUserData() {
    this.userZodiacSign = this.cookieService.get('userZodiacSign') || null;
    this.visitCount = parseInt(this.cookieService.get('visitCount') || '0');
    this.isReturningUser = this.visitCount > 1;
  }

  // ✅ Personalizar experiencia
  personalizeExperience() {
    if (this.isReturningUser) {
      this.showWelcomeBackMessage();
    }

    if (this.userZodiacSign) {
      this.highlightZodiacContent();
    }
  }

  // ✅ Trackear visita
  trackVisit() {
    this.visitCount++;
    this.cookieService.set('visitCount', this.visitCount.toString(), 30);
    this.cookieService.set('lastVisit', new Date().toISOString(), 30);
  }

  // ✅ Aceptar cookies
  acceptCookies() {
    this.cookieService.set('cookieConsent', 'accepted', 365);
    this.showCookieBanner = false;

    this.initializeCookies();
    this.enableAnalytics();
    this.sendAnalytics(); // 👈 Usa el método refactorizado

    this.logger.info('Cookies aceptadas - Analytics iniciado');
  }

  // ✅ Rechazar cookies
  rejectCookies() {
    this.cookieService.set('cookieConsent', 'rejected', 365);
    this.showCookieBanner = false;
    this.logger.log('Cookies rechazadas');
  }

  navigateTo(route: string): void {
    if (this.cookieService.get('cookieConsent') === 'accepted') {
      this.trackServiceVisit(route);
      this.trackServicePopularity(route);
      this.sendPageViewAnalytics(route);
    }
    this.router.navigate([route]);
  }

 

  async sendPageViewAnalytics(route: string) {
    try {
      await this.analyticsService.sendPageViewAnalytics(
        route,
        this.sessionStartTime
      );
    } catch (error) {
      this.logger.error('Error enviando page analytics:', error);
    }
  }
  
  private saveAnalyticsLocally(data: any) {
    try {
      let localAnalytics = JSON.parse(
        localStorage.getItem('pendingAnalytics') || '[]'
      );
      localAnalytics.push(data);
      localStorage.setItem('pendingAnalytics', JSON.stringify(localAnalytics));
      this.logger.log('Analytics guardados localmente como backup');
    } catch (error) {
      this.logger.error('Error guardando analytics localmente:', error);
    }
  }
  
  async sendPendingAnalytics() {
    try {
      await this.analyticsService.sendPendingAnalytics();
    } catch (error) {
      this.logger.error('Error enviando analytics pendientes:', error);
    }
  }

  // ✅ Funciones auxiliares
  private showWelcomeBackMessage() {
    // Mostrar mensaje de bienvenida personalizado
    this.logger.log(
      `¡Bienvenido de vuelta! Esta es tu visita número ${this.visitCount}`
    );
  }
  
  private highlightZodiacContent() {
    // Destacar contenido relacionado con el signo zodiacal
    this.logger.log(`Personalizando para signo: ${this.userZodiacSign}`);
  }

  private enableAnalytics() {
    // Habilitar Google Analytics u otras herramientas
    this.logger.info('Analytics habilitado');
  }
    async enviarSugerencia() {
    // Validar input
    if (!this.sugerenciaTexto || this.sugerenciaTexto.trim().length === 0) {
      this.mostrarMensajeSugerencia('Por favor, escribe una sugerencia', 'error');
      return;
    }

    if (this.sugerenciaTexto.length > 1000) {
      this.mostrarMensajeSugerencia('La sugerencia no puede exceder 1000 caracteres', 'error');
      return;
    }

    // Enviar sugerencia
    this.enviandoSugerencia = true;
    this.cdr.markForCheck();
    
    try {
      const response = await this.sugerenciasService.enviarSugerencia(this.sugerenciaTexto).toPromise();
      
      if (response?.success) {
        this.mostrarMensajeSugerencia('✅ ¡Sugerencia enviada con éxito!', 'success');
        this.sugerenciaTexto = ''; // Limpiar input
      } else {
        this.mostrarMensajeSugerencia('Error al enviar sugerencia', 'error');
      }
      
    } catch (error) {
      this.logger.error('Error enviando sugerencia:', error);
      this.mostrarMensajeSugerencia(
        typeof error === 'string' ? error : 'Error de conexión. Intenta nuevamente.',
        'error'
      );
    } finally {
      this.enviandoSugerencia = false;
      this.cdr.markForCheck();
    }
  }
    // Mostrar mensaje de confirmación
  private mostrarMensajeSugerencia(texto: string, tipo: 'success' | 'error') {
    this.mensajeSugerencia = { texto, tipo };
    this.cdr.markForCheck();
    
    // Ocultar mensaje después de 4 segundos
    setTimeout(() => {
      this.mensajeSugerencia = null;
      this.cdr.markForCheck();
    }, 4000);
  }

  // Trackear sugerencia enviada

  // Manejar Enter en el input
  onSugerenciaKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !this.enviandoSugerencia) {
      this.enviarSugerencia();
    }
  }
}
