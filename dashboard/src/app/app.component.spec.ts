import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {provideHttpClient} from '@angular/common/http';
import {of} from 'rxjs';
import {AppComponent} from './app.component';
import {AuthService} from './services/auth.service';
describe('Vibes shell',()=>{
 beforeEach(async()=>{await TestBed.configureTestingModule({imports:[AppComponent],providers:[provideRouter([]),provideHttpClient(),{provide:AuthService,useValue:{user$:of({email:'admin@example.test',role:'admin'}),logout:()=>of({}),logoutAll:()=>of({})}}]}).compileComponents();});
 it('renders Vibes branding and administrative navigation',()=>{const fixture=TestBed.createComponent(AppComponent);fixture.detectChanges();const el=fixture.nativeElement as HTMLElement;expect(el.textContent).toContain('Vibes');expect(el.querySelector('[routerLink="/dashboard/libraries"]')?.textContent).toContain('Media Libraries');expect(el.querySelector('nav')?.getAttribute('aria-label')).toBe('Main navigation');});
 it('toggles mobile navigation',()=>{const fixture=TestBed.createComponent(AppComponent);fixture.componentInstance.toggleSidebar();expect(fixture.componentInstance.isSidebarOpen).toBeTrue();fixture.componentInstance.toggleSidebar();expect(fixture.componentInstance.isSidebarOpen).toBeFalse();});
});
