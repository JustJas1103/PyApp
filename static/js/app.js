// Main App JS: camera, upload, detection, and rendering
(function(){
  const qs = (sel) => document.querySelector(sel);
  const qsa = (sel) => Array.from(document.querySelectorAll(sel));

  let videoStream = null;
  const basket = new Set();
  const LS_KEY = 'recipeAssistant.basket';
  const FAVORITES_KEY = 'recipeAssistant.favorites';
  let isOffline = !navigator.onLine;
  let favorites = new Set();
  
  function saveBasket(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(Array.from(basket))); }catch(e){} }
  function loadBasket(){ try{ const arr = JSON.parse(localStorage.getItem(LS_KEY)||'[]'); if(Array.isArray(arr)) arr.forEach(i=> basket.add(String(i).toLowerCase())); }catch(e){} }
  
  function saveFavorites(){ try{ localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favorites))); }catch(e){} }
  function loadFavorites(){ try{ const arr = JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]'); if(Array.isArray(arr)) favorites = new Set(arr); }catch(e){} }
  function toggleFavorite(recipeName){ 
    if(favorites.has(recipeName)){ favorites.delete(recipeName); } 
    else { favorites.add(recipeName); } 
    saveFavorites(); 
  }
  
  // Pagination state
  let allRecipes = [];
  let currentPage = 1;
  const recipesPerPage = 12;

  function show(el){ el.classList.remove('d-none'); }
  function hide(el){ el.classList.add('d-none'); }

  function toast(message, variant = 'danger'){
    const containerId = 'toastContainer';
    let container = qs('#'+containerId);
    if (!container){
      container = document.createElement('div');
      container.id = containerId;
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const id = 't'+Date.now();
    container.insertAdjacentHTML('beforeend', `
      <div id="${id}" class="toast align-items-center text-bg-${variant} border-0" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
          <div class="toast-body">${message}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
      </div>`);
    const t = new bootstrap.Toast(qs('#'+id), { delay: 3500 });
    t.show();
  }

  async function startCamera(){
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      videoStream = stream;
      qs('#videoElement').srcObject = stream;
      show(qs('#cameraContainer'));
      hide(qs('#previewContainer'));
      hide(qs('#startCameraBtn'));
      show(qs('#captureBtn'));
      show(qs('#stopCameraBtn'));
    } catch (err){
      toast('Camera error: ' + err.message);
    }
  }

  function stopCamera(){
    if (videoStream){
      videoStream.getTracks().forEach(t => t.stop());
      videoStream = null;
    }
    hide(qs('#cameraContainer'));
    show(qs('#startCameraBtn'));
    hide(qs('#captureBtn'));
    hide(qs('#stopCameraBtn'));
  }

  function capturePhoto(){
    const video = qs('#videoElement');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg');
    qs('#preview').src = imageData;
    show(qs('#previewContainer'));
    hide(qs('#cameraContainer'));
    detectIngredients(imageData);
  }

  function onUploadChange(e){
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const imageData = ev.target.result;
      qs('#preview').src = imageData;
      show(qs('#previewContainer'));
      hide(qs('#cameraContainer'));
      detectIngredients(imageData);
    };
    reader.readAsDataURL(file);
  }

  function drawBoundingBoxes(boxes, imgElement){
    if (!boxes || !boxes.length) {
      // If no boxes, just remove any existing canvas overlay
      const container = qs('#previewContainer');
      const oldCanvas = container.querySelector('canvas');
      if (oldCanvas) oldCanvas.remove();
      return;
    }
    
    const container = qs('#previewContainer');
    // Remove any existing canvas
    const oldCanvas = container.querySelector('canvas');
    if (oldCanvas) oldCanvas.remove();
    
    // Create canvas overlay
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.className = 'rounded-3';
    
    // Set canvas size to match image
    const rect = imgElement.getBoundingClientRect();
    canvas.width = imgElement.naturalWidth || rect.width;
    canvas.height = imgElement.naturalHeight || rect.height;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    
    container.style.position = 'relative';
    container.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    const scaleX = canvas.width / imgElement.naturalWidth;
    const scaleY = canvas.height / imgElement.naturalHeight;
    
    // Draw each bounding box
    boxes.forEach((box, idx) => {
      const x = box.x - (box.width / 2);
      const y = box.y - (box.height / 2);
      
      // Generate color based on index
      const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
      const color = colors[idx % colors.length];
      
      // Draw box
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, box.width, box.height);
      
      // Draw label background
      ctx.fillStyle = color;
      const label = `${box.class} ${box.confidence}%`;
      ctx.font = 'bold 16px Inter, sans-serif';
      const textWidth = ctx.measureText(label).width;
      ctx.fillRect(x, y - 25, textWidth + 10, 25);
      
      // Draw label text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x + 5, y - 7);
    });
  }

  function setLoading(loading){
    if (loading) show(qs('#loadingIndicator')); else hide(qs('#loadingIndicator'));
  }

  function renderRawDetections(list){
    const box = qs('#rawDetections');
    box.innerHTML = list.map(d => `<span class="badge rounded-pill bg-light text-dark me-2 mb-2">${d.class}: ${d.confidence}%</span>`).join('');
    show(qs('#detectionInfo'));
  }

  function renderIngredients(items){
    const box = qs('#ingredientList');
    if (!items || !items.length){
      box.innerHTML = '<div class="text-center text-muted py-3">No ingredients detected above the confidence threshold.</div>';
    } else {
      box.innerHTML = items.map(i => `<span class="ingredient-tag ingredient-matched">${formatIngredient(i)}</span>`).join('');
    }
    show(qs('#ingredientsCard'));
  }

  function renderBasket(){
    const list = qs('#basketList');
    const items = Array.from(basket);
    if (items.length){
      list.innerHTML = items.map(i => `
        <span class="ingredient-tag ingredient-matched chip" data-item="${i}">
          <span>${formatIngredient(i)}</span>
          <span class="remove" title="Remove" aria-label="Remove">×</span>
        </span>`).join('');
      // Attach remove handlers (event delegation)
      list.querySelectorAll('.ingredient-tag .remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const tag = e.currentTarget.closest('.ingredient-tag');
          const val = tag.getAttribute('data-item');
          basket.delete(val);
          renderBasket();
          saveBasket();
          updateRecommendationsFromBasket();
        });
      });
    } else {
      list.innerHTML = '<span class="text-muted">No ingredients yet.</span>';
    }
    show(qs('#basketCard'));
  }

  function renderRecipePage(){
    const container = qs('#recipeContainer');
    const emptyEl = qs('#recipesEmpty');
    const paginationEl = qs('#recipePagination');
    const prevBtn = qs('#prevPageBtn');
    const nextBtn = qs('#nextPageBtn');
    const pageInfo = qs('#pageInfo');
    
    if (!allRecipes.length){
      container.innerHTML = '';
      if (emptyEl) emptyEl.classList.remove('d-none');
      if (paginationEl) hide(paginationEl);
      return;
    }
    
    if (emptyEl) emptyEl.classList.add('d-none');
    
    const start = (currentPage - 1) * recipesPerPage;
    const end = start + recipesPerPage;
    const pageRecipes = allRecipes.slice(start, end);
    const totalPages = Math.ceil(allRecipes.length / recipesPerPage);
    
    container.innerHTML = pageRecipes.map(recipeCard).join('');
    attachCardHandlers();
    
    // Update pagination controls
    if (totalPages > 1){
      show(paginationEl);
      pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
      prevBtn.disabled = currentPage === 1;
      nextBtn.disabled = currentPage === totalPages;
    } else {
      hide(paginationEl);
    }
  }

  async function updateRecommendationsFromBasket(){
    const items = Array.from(basket);
    const emptyEl = qs('#recipesEmpty');
    const container = qs('#recipeContainer');
    const recipesTitle = qs('#recipes');
    const closeBtn = qs('#closeRecipesBtn');
    
    // Reset to normal recommendations view
    if (recipesTitle) {
      recipesTitle.textContent = 'Recommendations';
    }
    if (closeBtn) {
      hide(closeBtn);
    }
    
    if (!items.length){
      // Clear recipes and show empty state
      allRecipes = [];
      currentPage = 1;
      if (container) container.innerHTML = '';
      if (emptyEl){ emptyEl.classList.remove('d-none'); }
      hide(qs('#recipePagination'));
      show(qs('#recipesCard'));
      return;
    }
    try{
      const res = await fetch('/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: items })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Recommend failed');
      // Only show recipes that have at least 1 matching ingredient
      allRecipes = (data.recipes||[]).filter(r => (r.match_percent||0) > 0);
      currentPage = 1;
      renderRecipePage();
      show(qs('#recipesCard'));
    }catch(err){
      toast(err.message || 'Recommend failed');
    }
  }

  function formatIngredient(ing){
    // Replace underscores with spaces and capitalize first letter of each word
    return ing.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function recipeCard(recipe){
    const matchPercent = recipe.match_percent !== undefined ? recipe.match_percent : 100;
    const badgeColor = matchPercent >= 50 ? 'success' : (matchPercent >= 25 ? 'warning' : 'secondary');
    const have = (recipe.matched_ingredients || []).map(i=>`<span class="ingredient-tag ingredient-matched">${formatIngredient(i)}</span>`).join('');
    const need = (recipe.needed_ingredients || []).slice(0,5).map(i=>`<span class="ingredient-tag ingredient-needed">${formatIngredient(i)}</span>`).join('');
    const more = (recipe.needed_ingredients||[]).length > 5 ? `<span class="small-muted">+${recipe.needed_ingredients.length-5} more</span>` : '';
    const isFav = favorites.has(recipe.name);
    const heartIcon = isFav ? '❤️' : '🤍';
    
    // Handle display for favorites/browse view vs recommendation view
    const matchDisplay = recipe.match_percent !== undefined 
      ? `<span class="badge text-bg-${badgeColor} match-badge">${recipe.match_percent}% Match</span>
         <div class="small-muted">${recipe.matched_count} of ${recipe.total_count} ingredients</div>`
      : `<span class="badge text-bg-info match-badge">All Ingredients</span>
         <div class="small-muted">${(recipe.ingredients||[]).length} total ingredients</div>`;
    
    // In favorites/browse view, show ingredients as "You need" instead of "You have"
    const ingredientSections = recipe.match_percent !== undefined
      ? `<div class="mb-2"><strong class="small">You have</strong><div>${have || '<span class="text-muted small">None</span>'}</div></div>
         <div class="mb-2"><strong class="small">You need</strong><div>${need} ${more}</div></div>`
      : `<div class="mb-2"><strong class="small">You need</strong><div>${have || '<span class="text-muted small">No ingredients listed</span>'}</div></div>`;
    
    return `
      <div class="col-md-6 col-xl-4">
        <div class="card recipe-card h-100 p-3" style="position:relative;">
          <button class="btn position-absolute top-0 end-0 mt-2 me-2 favorite-btn" data-recipe-name="${recipe.name}" style="font-size:24px;border:none;background:transparent;z-index:2;min-width:44px;min-height:44px;padding:8px;display:flex;align-items:center;justify-content:center;pointer-events:auto;" title="Add to favorites" aria-label="Toggle favorite">
            ${heartIcon}
          </button>
          <div class="text-center" style="font-size:48px">${recipe.image}</div>
          <h6 class="mt-2 mb-1 text-center">${recipe.name}</h6>
          <div class="text-center small-muted mb-2">${recipe.time} • ${typeof recipe.servings === 'string' ? recipe.servings : recipe.servings || 4} servings • ${recipe.difficulty}</div>
          <div class="text-center mb-3">
            ${matchDisplay}
          </div>
          ${ingredientSections}
          <div class="mt-auto d-grid" style="position:relative;z-index:1;">
            <button class="btn btn-outline-primary btn-sm view-details-btn" data-recipe='${JSON.stringify(recipe).replace(/'/g, '&#39;')}'>View Details</button>
          </div>
        </div>
      </div>`
  }

  function attachCardHandlers(){
    qsa('#recipeContainer .view-details-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        try {
          const recipeData = btn.getAttribute('data-recipe');
          const recipe = JSON.parse(recipeData);
          showRecipeModal(recipe);
        } catch (err) {
          console.error('Error showing recipe modal:', err);
          toast('Error loading recipe details: ' + err.message, 'danger');
        }
      });
    });
    qsa('#recipeContainer .favorite-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const recipeName = btn.getAttribute('data-recipe-name');
        toggleFavorite(recipeName);
        btn.textContent = favorites.has(recipeName) ? '❤️' : '🤍';
        toast(`${favorites.has(recipeName) ? 'Added to' : 'Removed from'} favorites`, 'success');
      });
    });
  }



  function showRecipeModal(recipe){
    try {
      qs('#recipeModalLabel').textContent = recipe.name;
      qs('#modalEmoji').textContent = recipe.image || '🍽️';
      const servingsDisplay = typeof recipe.servings === 'string' ? recipe.servings : `${recipe.servings || 4}`;
      qs('#modalMeta').textContent = `${recipe.time} • ${servingsDisplay} servings • ${recipe.difficulty}`;
      
      // Handle match display - show percentage or "All Ingredients" for browse/favorites view
      const matchText = recipe.match_percent !== undefined 
        ? `${recipe.match_percent}% match` 
        : 'All Ingredients';
      qs('#modalMatch').textContent = matchText;
      
      // In favorites/browse view, show all ingredients as "You need"
      const ingredientsContainer = qs('#modalIngredients');
      if (recipe.match_percent !== undefined) {
        // Recommendations view - show "You have" and "You need"
        ingredientsContainer.innerHTML = `
          <div class="col-md-6">
            <h6>✅ You have</h6>
            <div>${(recipe.matched_ingredients||[]).map(i=>`<span class="ingredient-tag ingredient-matched">${formatIngredient(i)}</span>`).join('') || '<span class="text-muted small">None</span>'}</div>
          </div>
          <div class="col-md-6">
            <h6>🛒 You need</h6>
            <div>${(recipe.needed_ingredients||[]).map(i=>`<span class="ingredient-tag ingredient-needed">${formatIngredient(i)}</span>`).join('') || '<span class="text-muted small">None</span>'}</div>
          </div>`;
      } else {
        // Favorites/Browse view - show only "You need"
        ingredientsContainer.innerHTML = `
          <div class="col-12">
            <h6>🛒 Ingredients you need</h6>
            <div>${(recipe.matched_ingredients||[]).map(i=>`<span class="ingredient-tag ingredient-needed">${formatIngredient(i)}</span>`).join('') || '<span class="text-muted small">No ingredients listed</span>'}</div>
          </div>`;
      }
      
      qs('#modalInstructions').textContent = recipe.instructions || '';
      
      const modalEl = qs('#recipeModal');
      if (!modalEl) {
        toast('Modal element not found', 'danger');
        return;
      }
      
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    } catch (err) {
      console.error('Error in showRecipeModal:', err);
      toast('Error showing recipe: ' + err.message, 'danger');
    }
  }

  async function detectIngredients(imageData){
    setLoading(true);
    try{
      const res = await fetch(window.APP_CONFIG.detectUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData })
      });
      const data = await res.json();
      if (!data.success){ throw new Error(data.error || 'Unknown error'); }
      
      if (data.raw_detections && data.raw_detections.length) renderRawDetections(data.raw_detections);
      const newlyDetected = (data.detected_ingredients || []).map(i => (i||'').toLowerCase());
      renderIngredients(newlyDetected);

      
      // Draw bounding boxes on the image
      if (data.bounding_boxes && data.bounding_boxes.length) {
        const imgElement = qs('#preview');
        // Wait for image to load before drawing
        if (imgElement.complete) {
          drawBoundingBoxes(data.bounding_boxes, imgElement);
        } else {
          imgElement.onload = () => drawBoundingBoxes(data.bounding_boxes, imgElement);
        }
      }

      // Auto-stack: add newly detected ingredients into the basket and update recommendations
      if (newlyDetected.length){
        newlyDetected.forEach(i => { if (i) basket.add(i); });
        saveBasket();
        toast(`Added ${newlyDetected.length} detected ingredient${newlyDetected.length>1?'s':''} to your list`, 'success');
      }
      renderBasket();
      await updateRecommendationsFromBasket();
      // Ensure the right-side suggestions are visible
      qs('#recipesCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err){
      console.error('Detection error:', err);
      toast(err.message || 'Detection failed');
    } finally {
      setLoading(false);
    }
  }

  // Cleanup on page unload/close
  window.addEventListener('beforeunload', () => {
    if (videoStream) {
      videoStream.getTracks().forEach(t => t.stop());
    }
  });

  // Handle visibility changes (app going to background)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && videoStream) {
      stopCamera();
    }
  });

  // Update offline status UI
  function updateOfflineStatus() {
    isOffline = !navigator.onLine;
    const offlineIndicator = qs('#offlineIndicator');
    const offlineBanner = qs('#offlineBanner');
    const startCameraBtn = qs('#startCameraBtn');
    const uploadBtn = qs('#imageUpload');
    const uploadLabel = qs('label[for="imageUpload"]');
    
    if (isOffline) {
      // Show offline indicators
      if (offlineIndicator) show(offlineIndicator);
      if (offlineBanner) show(offlineBanner);
      
      // Disable camera and upload features
      if (startCameraBtn) {
        startCameraBtn.disabled = true;
        startCameraBtn.classList.add('disabled');
      }
      if (uploadBtn) uploadBtn.disabled = true;
      if (uploadLabel) {
        uploadLabel.classList.add('disabled', 'opacity-50');
        uploadLabel.style.pointerEvents = 'none';
      }
      const dropZone = qs('#dropZone');
      if (dropZone) hide(dropZone);
    } else {
      // Hide offline indicators
      if (offlineIndicator) hide(offlineIndicator);
      if (offlineBanner) hide(offlineBanner);
      
      // Enable camera and upload features
      if (startCameraBtn) {
        startCameraBtn.disabled = false;
        startCameraBtn.classList.remove('disabled');
      }
      if (uploadBtn) uploadBtn.disabled = false;
      if (uploadLabel) {
        uploadLabel.classList.remove('disabled', 'opacity-50');
        uploadLabel.style.pointerEvents = 'auto';
      }
      const dropZone = qs('#dropZone');
      if (dropZone) show(dropZone);
    }
  }

  // Show all recipes when offline browse button is clicked
  function showAllRecipesOffline() {
    // Use embedded recipes data (always available offline)
    const recipesData = window.OFFLINE_RECIPES || [];
    
    if (recipesData.length > 0) {
      // Add match percentage (100% since showing all recipes)
      allRecipes = recipesData.map(recipe => ({
        ...recipe,
        matched_ingredients: recipe.ingredients || [],
        needed_ingredients: []
      }));
      currentPage = 1;
      renderRecipePage();
      show(qs('#recipesCard'));
      hide(qs('#recipesEmpty'));
      
      // Update recipes card title and show close button
      const recipesTitle = qs('#recipes');
      const closeBtn = qs('#closeRecipesBtn');
      if (recipesTitle) {
        recipesTitle.textContent = 'All Recipes';
      }
      if (closeBtn) {
        show(closeBtn);
      }
      
      qs('#recipesCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast(`Showing all ${recipesData.length} recipes`, 'success');
    } else {
      toast('No recipes available', 'info');
    }
  }

  // Show favorite recipes
  function showFavoriteRecipes() {
    if (favorites.size === 0) {
      toast('No favorites yet. Add recipes to favorites by clicking the ❤️ icon!', 'info');
      return;
    }

    // Get all recipes from embedded data
    const recipesData = window.OFFLINE_RECIPES || [];
    
    // Filter to only show favorited recipes
    const favoriteRecipesList = recipesData.filter(recipe => favorites.has(recipe.name));
    
    if (favoriteRecipesList.length > 0) {
      allRecipes = favoriteRecipesList.map(recipe => ({
        ...recipe,
        matched_ingredients: recipe.ingredients || [],
        needed_ingredients: []
      }));
      currentPage = 1;
      renderRecipePage();
      show(qs('#recipesCard'));
      hide(qs('#recipesEmpty'));
      
      // Update recipes card title and show close button
      const recipesTitle = qs('#recipes');
      const closeBtn = qs('#closeRecipesBtn');
      if (recipesTitle) {
        recipesTitle.textContent = 'My Favorites';
      }
      if (closeBtn) {
        show(closeBtn);
      }
      
      qs('#recipesCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast(`Showing ${favoriteRecipesList.length} favorite recipe${favoriteRecipesList.length > 1 ? 's' : ''}`, 'success');
    } else {
      toast('No favorite recipes found', 'info');
    }
  }

  // Wire up events
  window.addEventListener('DOMContentLoaded', () => {
    // Check offline status on load
    updateOfflineStatus();
    
    // Load basket and favorites
    loadBasket();
    loadFavorites();
    renderBasket();
    // Reflect current basket into recommendations (and show empty-state if none)
    updateRecommendationsFromBasket();
    // Threshold slider removed; using server default threshold

    qs('#startCameraBtn').addEventListener('click', startCamera);
    qs('#stopCameraBtn').addEventListener('click', stopCamera);
    qs('#captureBtn').addEventListener('click', capturePhoto);
    qs('#imageUpload').addEventListener('change', onUploadChange);

    // Drag and Drop (desktop only)
    const drop = qs('#dropZone');
    if (drop){
      ;['dragenter','dragover'].forEach(evt => drop.addEventListener(evt, (e)=>{ e.preventDefault(); e.stopPropagation(); drop.classList.add('dragover'); }));
      ;['dragleave','drop'].forEach(evt => drop.addEventListener(evt, (e)=>{ e.preventDefault(); e.stopPropagation(); drop.classList.remove('dragover'); }));
      drop.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const imageData = ev.target.result;
          qs('#preview').src = imageData;
          show(qs('#previewContainer'));
          hide(qs('#cameraContainer'));
          detectIngredients(imageData);
        };
        reader.readAsDataURL(file);
      });
    }

    const clearBtn = qs('#clearBasketBtn');
    if (clearBtn){
      clearBtn.addEventListener('click', () => {
        basket.clear();
        renderBasket();
        saveBasket();
        updateRecommendationsFromBasket();
        toast('Cleared ingredient list', 'info');
      });
    }

    // Clear preview button
    const clearPreviewBtn = qs('#clearPreviewBtn');
    if (clearPreviewBtn){
      clearPreviewBtn.addEventListener('click', () => {
        hide(qs('#previewContainer'));
        hide(qs('#detectionInfo'));
        hide(qs('#ingredientsCard'));
        qs('#preview').src = '';
        // Remove any canvas overlay
        const container = qs('#previewContainer');
        const oldCanvas = container.querySelector('canvas');
        if (oldCanvas) oldCanvas.remove();
        toast('Cleared preview image', 'info');
      });
    }

    // Offline mode browse button (only in banner now)
    const offlineBrowseBtn = qs('#offlineBrowseBtn');
    if (offlineBrowseBtn) {
      offlineBrowseBtn.addEventListener('click', showAllRecipesOffline);
    }

    // Favorites button
    const favoritesBtn = qs('#favoritesBtn');
    if (favoritesBtn) {
      favoritesBtn.addEventListener('click', showFavoriteRecipes);
    }

    // Close recipes button (back to basket recommendations)
    const closeRecipesBtn = qs('#closeRecipesBtn');
    if (closeRecipesBtn) {
      closeRecipesBtn.addEventListener('click', () => {
        updateRecommendationsFromBasket();
        toast('Returned to recommendations', 'info');
      });
    }

    // Pagination controls
    const prevBtn = qs('#prevPageBtn');
    const nextBtn = qs('#nextPageBtn');
    if (prevBtn){
      prevBtn.addEventListener('click', () => {
        if (currentPage > 1){
          currentPage--;
          renderRecipePage();
          qs('#recipesCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
    if (nextBtn){
      nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(allRecipes.length / recipesPerPage);
        if (currentPage < totalPages){
          currentPage++;
          renderRecipePage();
          qs('#recipesCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  });

  // Listen for online/offline events
  window.addEventListener('online', () => {
    updateOfflineStatus();
    toast('Back online! Camera and upload features are now available.', 'success');
  });
  
  window.addEventListener('offline', () => {
    updateOfflineStatus();
    toast('You are offline. Browse recipes, but camera and upload are disabled.', 'warning');
  });
})();
