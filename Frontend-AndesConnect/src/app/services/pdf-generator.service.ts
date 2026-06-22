import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Certificate } from '../shared/types';

@Injectable({
  providedIn: 'root'
})
export class PdfGeneratorService {

  constructor() { }

  private formatDate(ts: number): string {
    const d = new Date(ts);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }

  public async generateCertificatePdf(cert: Certificate): Promise<void> {
    // 1. Crear el contenedor HTML oculto
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '-9999px';
    container.style.left = '-9999px';
    container.style.width = '850px';
    container.style.height = '600px';

    const content = `
      <div class="certificate-container" style="
        width: 850px; height: 600px; padding: 30px; 
        border: 12px double #1e3a5f; background-color: #ffffff; 
        position: relative; box-sizing: border-box; 
        background-image: radial-gradient(circle, #ffffff 60%, #f4f7fa 100%);
        font-family: 'Georgia', serif;
      ">
        <div class="inner-border" style="
          border: 2px solid #c9a054; height: 100%; padding: 35px; 
          box-sizing: border-box; display: flex; flex-direction: column; 
          align-items: center; justify-content: space-between; text-align: center;
        ">
          <div class="ribbon" style="font-size: 50px; margin-bottom: 5px; color: #c9a054;">🎓</div>
          <div class="header" style="font-size: 32px; color: #1e3a5f; letter-spacing: 3px; font-weight: bold; text-transform: uppercase; margin: 0;">AndesConnect Educa</div>
          <div class="sub-header" style="font-size: 14px; color: #5c6b73; margin-top: 5px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 5px; font-weight: bold;">Certificado de Aprobación</div>
          
          <div class="certifies" style="font-style: italic; font-size: 18px; color: #4a4a4a; margin: 5px 0;">Otorgado a:</div>
          <div class="student-name" style="font-size: 40px; color: #c9a054; border-bottom: 2px solid #c9a054; padding-bottom: 8px; margin: 10px 0; font-weight: bold; font-family: 'Times New Roman', Times, serif; min-width: 450px;">
            ${cert.studentName}
          </div>
          
          <div class="course-text" style="font-size: 16px; color: #4a4a4a; margin: 5px 0;">Por completar satisfactoriamente y aprobar todas las evaluaciones del curso técnico:</div>
          <div class="course-title" style="font-size: 26px; color: #1e3a5f; margin: 8px 0; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
            "${cert.courseTitle}"
          </div>
          
          <div class="footer-section" style="display: flex; justify-content: space-between; width: 100%; margin-top: 25px; padding-top: 15px; border-top: 1px solid #e2e8f0; text-align: left;">
            <div class="meta-box" style="font-size: 12px; color: #64748b; line-height: 1.6;">
              <strong>Código de Validación:</strong> ${cert.id}<br>
              <strong>Fecha de Emisión:</strong> ${this.formatDate(cert.issuedAt)}<br>
              <strong>Verificación:</strong> andesconnect.org/certs/${cert.id}
            </div>
            <div class="signature-box" style="display: flex; flex-direction: column; align-items: center; font-size: 13px; color: #334155;">
              <div class="signature-line" style="width: 180px; border-top: 1px dashed #94a3b8; margin-bottom: 5px;"></div>
              <strong>${cert.instructor}</strong>
              <span>Docente Principal</span>
            </div>
          </div>
        </div>
        <div class="badge-seal" style="
          position: absolute; bottom: 100px; right: 80px; width: 80px; height: 80px; 
          border: 3px double #c9a054; border-radius: 50%; display: flex; 
          justify-content: center; align-items: center; font-size: 11px; 
          color: #c9a054; font-weight: bold; text-transform: uppercase; 
          transform: rotate(-15deg); background: #fff; text-align: center;
        ">
          Oficial<br>AndesConnect
        </div>
      </div>
    `;

    container.innerHTML = content;
    document.body.appendChild(container);

    try {
      // 2. Renderizar usando html2canvas
      const canvas = await html2canvas(container, {
        scale: 2, // Mejor calidad
        useCORS: true,
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');

      // 3. Crear PDF e incrustar imagen
      // Orientación apaisada (landscape), unidad pt, formato [850, 600] apx.
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [850, 600]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, 850, 600);
      
      // 4. Descargar el archivo
      const filename = `Certificado_${cert.courseTitle.replace(/\s+/g, '_')}.pdf`;
      pdf.save(filename);

    } catch (e) {
      console.error('Error generando PDF', e);
    } finally {
      // Limpiar DOM
      document.body.removeChild(container);
    }
  }
}
