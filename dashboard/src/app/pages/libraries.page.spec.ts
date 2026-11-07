import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of,throwError} from 'rxjs';
import {LibrariesPage} from './libraries.page';
import {MediaApiService} from '../services/media-api.service';
import {FeedbackService} from '../shared/components/confirmation-dialog.component';
describe('Media libraries',()=>{
 let api:jasmine.SpyObj<MediaApiService>;
 beforeEach(async()=>{
  api=jasmine.createSpyObj('MediaApiService',['getLibraries','getMediaRoots','getCategories','startScan','createLibrary','getScans','getScan']);
  api.getLibraries.and.returnValue(of({libraries:[]}));api.getMediaRoots.and.returnValue(of({roots:[{id:'vibes',path:'/media/vibes'}]}));api.getCategories.and.returnValue(of([]));
  await TestBed.configureTestingModule({imports:[LibrariesPage],providers:[provideRouter([]),{provide:MediaApiService,useValue:api},{provide:FeedbackService,useValue:{confirm:async()=>true}}]}).compileComponents();
 });
 it('shows real empty state and authorized roots',()=>{const fixture=TestBed.createComponent(LibrariesPage);fixture.detectChanges();expect(fixture.nativeElement.textContent).toContain('Your universe starts here');fixture.nativeElement.querySelector('button').click();fixture.detectChanges();expect(fixture.nativeElement.textContent).toContain('/media/vibes');});
 it('displays API failures instead of simulated completion',()=>{api.getLibraries.and.returnValue(throwError(()=>({error:{error:{message:'Drive unavailable'}}})));const fixture=TestBed.createComponent(LibrariesPage);fixture.detectChanges();expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Drive unavailable');expect(api.startScan).not.toHaveBeenCalled();});
 it('submits the selected root identifier and relative folder',()=>{api.createLibrary.and.returnValue(of({}));const fixture=TestBed.createComponent(LibrariesPage);fixture.detectChanges();const page=fixture.componentInstance;page.add();page.form.name='My collection';page.form.relativePath='Technology';page.save();expect(api.createLibrary).toHaveBeenCalledWith(jasmine.objectContaining({name:'My collection',rootId:'vibes',relativePath:'Technology'}));});
});
