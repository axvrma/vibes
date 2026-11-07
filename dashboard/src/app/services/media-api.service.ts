import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpRequest } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, forkJoin, of, switchMap, map } from 'rxjs';
import { MediaLibrary, ScanJob, LibraryConfig, Overview, VideoPage } from './media.models';

@Injectable({ providedIn: 'root' })
export class MediaApiService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getSummary(): Observable<Overview> {
    return this.http.get<Overview>(`${this.apiUrl}/summary`);
  }

  getVideos(params: Record<string,string|number> = {}): Observable<VideoPage> {
    return this.http.get<VideoPage>(`${this.apiUrl}/videos`,{params}).pipe(switchMap(page=>{
      if(!page.videos.length) return of(page);
      return forkJoin(page.videos.map(video=>this.mediaTicket(video.id,'thumbnail').pipe(map(ticket=>({...video,thumbnailUrl:ticket.url}))))).pipe(map(videos=>({...page,videos})));
    }));
  }
  mediaTicket(id:string,kind:'stream'|'thumbnail') { return this.http.post<{url:string;expiresAt:string}>(`${this.apiUrl}/videos/${id}/media-ticket`,{kind}); }
  getLibraries() { return this.http.get<{libraries:MediaLibrary[]}>(`${this.apiUrl}/libraries`); }
  getMediaRoots() { return this.http.get<{roots:{id:string;path:string}[]}>(`${this.apiUrl}/media-roots`); }
  createLibrary(config:LibraryConfig) { return this.http.post(`${this.apiUrl}/libraries`,config); }
  updateLibrary(id:string,config:Partial<Omit<LibraryConfig,'rootId'|'relativePath'>>) {return this.http.patch(`${this.apiUrl}/libraries/${id}`,config);}
  removeLibrary(id:string) {return this.http.delete(`${this.apiUrl}/libraries/${id}`);}
  startScan(id:string) {return this.http.post<{job:ScanJob}>(`${this.apiUrl}/libraries/${id}/scans`,{});}
  getScans(id:string) {return this.http.get<{jobs:ScanJob[]}>(`${this.apiUrl}/libraries/${id}/scans`);}
  getScan(id:string) {return this.http.get<{job:ScanJob;errors:{relative_path:string;message:string}[]}>(`${this.apiUrl}/scans/${id}`);}
  cancelScan(id:string) {return this.http.post(`${this.apiUrl}/scans/${id}/cancel`,{});}

  uploadVideo(formData: FormData): Observable<HttpEvent<any>> {
    const req = new HttpRequest('POST', `${this.apiUrl}/upload`, formData, {
      reportProgress: true
    });
    return this.http.request(req);
  }

  deleteVideo(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/videos/${id}`);
  }

  getTags(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/tags`);
  }

  createTag(tag: { name: string; color: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/tags`, tag);
  }

  updateTag(id: string, tag: { name?: string; color?: string }): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/tags/${id}`, tag);
  }

  deleteTag(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/tags/${id}`);
  }

  attachTag(videoId: string, tagId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/videos/${videoId}/tags`, { tagId });
  }

  detachTag(videoId: string, tagId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/videos/${videoId}/tags/${tagId}`);
  }

  getCategories(includeInactive: boolean = false): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/categories?includeInactive=${includeInactive}`);
  }

  createCategory(category: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/categories`, category);
  }

  updateCategory(id: string, category: any): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/categories/${id}`, category);
  }

  deleteCategory(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/categories/${id}`);
  }

  assignTagToCategory(categoryId: string, tagId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/categories/${categoryId}/tags`, { tagId });
  }

  removeTagFromCategory(categoryId: string, tagId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/categories/${categoryId}/tags/${tagId}`);
  }

  updateVideoTitle(id:string,title:string){return this.http.patch(`${this.apiUrl}/videos/${id}`,{title});}
  bulkVideoCategory(ids:string[],categoryId:string|null){return this.http.patch(`${this.apiUrl}/videos/bulk`,{ids,categoryId});}
  updateVideoCategory(videoId: string, payload: { categoryId: string | null; removeIncompatibleTags?: boolean }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/videos/${videoId}/category`, payload);
  }

  getUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/users`);
  }

  updateUserStatus(userId: string, is_active: boolean): Observable<any> {
    return this.http.patch(`${this.apiUrl}/users/${userId}/status`, { is_active: is_active ? 1 : 0 });
  }

  deleteUser(userId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/users/${userId}`);
  }

  updateUserPassword(userId: string, password: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/users/${userId}/password`, { password });
  }
}
