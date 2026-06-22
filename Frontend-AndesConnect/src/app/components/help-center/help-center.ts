import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { TranslationService } from '../../services/translation.service';
import { AuthService } from '../../services/auth.service';
import { NavbarComponent } from '../layout/navbar';
import { FooterComponent } from '../layout/footer/footer';

interface FaqItem {
  id: number;
  questionKey: string;
  answerKey: string;
  open: boolean;
}

@Component({
  selector: 'app-help-center',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent, FooterComponent],
  templateUrl: './help-center.html',
  styleUrls: ['./help-center.css']
})
export class HelpCenterComponent implements OnInit {
  protected readonly ts = inject(TranslationService);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  protected readonly downloadMessage = signal('');

  protected readonly faqItems = signal<FaqItem[]>([
    { id: 1, questionKey: 'help.faq1_q', answerKey: 'help.faq1_a', open: false },
    { id: 2, questionKey: 'help.faq2_q', answerKey: 'help.faq2_a', open: false },
    { id: 3, questionKey: 'help.faq3_q', answerKey: 'help.faq3_a', open: false },
    { id: 4, questionKey: 'help.faq4_q', answerKey: 'help.faq4_a', open: false },
    { id: 5, questionKey: 'help.faq5_q', answerKey: 'help.faq5_a', open: false },
  ]);

  async ngOnInit(): Promise<void> {
    if (this.auth.isAuthenticated() && !this.auth.isGuest()) {
      try {
        const faqs = await firstValueFrom(
          this.http.get<any[]>(`${environment.apiUrl}/faqs/`)
        );
        if (faqs && faqs.length > 0) {
          this.faqItems.set(faqs.map((f, index) => ({
            id: f.id || index + 1,
            questionKey: f.clave_pregunta,
            answerKey: f.clave_respuesta,
            open: false
          })));
        }
      } catch (err) {
        console.warn('Error fetching FAQs from database, using local defaults.', err);
      }
    }
  }

  toggleSymbol(item: FaqItem): string {
    return item.open ? '−' : '+';
  }

  downloadGuide(): void {
    const guideContent = `
ANDESCONNECT — GUÍA COMPLETA DE USO
====================================

1. PRIMEROS PASOS
-----------------
Accede a AndesConnect con tu correo y contraseña o en modo offline como invitado.
Si es tu primera vez, crea una cuenta gratuita con tu nombre, comunidad y rol.

2. DESCARGA DE CURSOS OFFLINE
------------------------------
Ve a Cursos > selecciona un curso > haz clic en "Descargar Offline".
Una vez descargado, accede desde Biblioteca Offline sin internet.

3. PROGRESO Y MÓDULOS
----------------------
Desde el Detalle del Curso accedes a todos los módulos. 
Márcalos como completados para avanzar y desbloquear módulos siguientes.

4. SINCRONIZACIÓN
-----------------
Ve a Estado de Sincronización para ver descargas y sincronizar tu progreso
cuando tengas conexión a internet.

5. CERTIFICADOS
---------------
Al completar todos los módulos de un curso recibirás un certificado digital
descargable desde la sección "Mis Certificados".

6. SOPORTE
----------
Email: soporte@andesconnect.org
Tel: +51 984 000 000

© 2026 AndesConnect Educa
    `.trim();

    const blob = new Blob([guideContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Guia_AndesConnect.txt';
    a.click();
    URL.revokeObjectURL(url);

    this.downloadMessage.set(this.ts.translate('help.guide_downloading'));
    setTimeout(() => this.downloadMessage.set(''), 3000);
  }

  toggleFaq(id: number): void {
    this.faqItems.update(items =>
      items.map(item =>
        item.id === id ? { ...item, open: !item.open } : { ...item, open: false }
      )
    );
  }
}
