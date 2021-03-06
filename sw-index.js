const DBrestaurantURL = 'https://guarded-cove-34449.herokuapp.com/restaurants/';
const DBreviewURL = 'https://guarded-cove-34449.herokuapp.com/reviews/';

const dbRestaurantPromise = openRestaurantDatabase();
const dbReviewPromise = openReviewDatabase();
loadDB(DBrestaurantURL, 'restaurants', dbRestaurantPromise);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw-cache.js', {scope: './'}).then(function(reg) {
    if(reg.installing) {
      console.log('Service worker installing');
    } else if(reg.waiting) {
      console.log('Service worker installed');
    } else if(reg.active) {
      console.log('Service worker active');
    }
  }).catch(function(error) {
    // registration failed
    console.log('Registration failed with ' + error);
  });
}

if ('serviceWorker' in navigator) {
  setInterval(function() {
    cleanImageCache();
  }, 1000 * 60 * 5);
}

function openRestaurantDatabase() {
  return idb.open('restaurant', 10, function(upgradeDb) {
    var store = upgradeDb.createObjectStore('restaurants', {
      keyPath: 'id'
    });
    store.createIndex('by-date', 'updatedAt');
  });
}

function openReviewDatabase() {
  return idb.open('review', 7, function(upgradeDb) {
    var store = upgradeDb.createObjectStore('reviews', {
      keyPath: 'id'
    });
    store.createIndex('by-date', 'updatedAt');
  });
}

// Check database for what is currently being posted and check it against
// cache request-response pairs.  If there is no database item for an item
// in the cache, delete from cache.
function cleanImageCache() {
  dbRestaurantPromise.then(function(db) {
    if (!db) return;

    var imagesNeeded = [];

    var tx = db.transaction('restaurants');
    return tx.objectStore('restaurants').getAll().then(function(messages) {
      messages.forEach(function(message) {
        if (message.photograph) {
          imagesNeeded.push(message.photograph);
        }
      });
      return caches.open('mws-content-imgs');
    }).then(function(cache) {
      return cache.keys().then(function(requests) {
        requests.forEach(function(request) {
          var url = new URL(request.url);
          if (!imagesNeeded.includes(url.pathname)) cache.delete(request);
        });
      });
    });
  });
};

/**
 * Fetch all reviews from resource db if available, otherwise fetch from idb
 */
function fetchReviews(callback) {
  return dbReviewPromise.then(function(db) {
    if (!db) return;
    // fetch data from reviews
    var index = db.transaction('reviews')
      .objectStore('reviews').index('by-date');

    return index.getAll().then(function(messages) {
      callback(null, messages);
    }).catch(function(error) {
      callback(error, null);
    });
  });
  return dbReviewPromise.then(function() {
    console.log("fetching reviews");
  });
}

// Sync resource db and idb
function syncReviewsDB(dbURL, dbName, dbPromise) {
  return fetchReviews(function(error, reviews) {  // fetch from idb
    if(reviews.length > 0){
      return dbPromise.then(function(db) {
        if (!db) return;
        return fetch(dbURL)  // fetch from resource db
          .then(function(response) {
            return response.json();
          }).then(function(items) {
            var tx = db.transaction(dbName, 'readwrite');
            var store = tx.objectStore(dbName);
            var idbAdd = false;
            // console.log("resource db (items) length: ", items.length); // resource db
            // console.log("idb (reviews) length: ",reviews.length); // idb
            let results = reviews;  // idb
            if (error) {
              callback(error, transaction);
            } else {
              for (var i = 0; i < items.length; i++) {
                let reviewresults = reviews;  // idb
                var modreview = reviewresults.find(r => r.id == items[i].id);
                if (modreview !== undefined && modreview.length > 0){
                  if (modreview.name != items[i].name || modreview.comments != items[i].comments || modreview.rating != items[i].rating){
                    // console.log("modifying idb: ", items[i].id);
                    store.delete(items[i].id);
                    store.put(items[i]);
                    idbAdd = true;
                  }
                }
                if (reviewresults.find(r => r.id == items[i].id) === undefined){
                  // console.log("adding to idb: ", items[i]);
                  store.put(items[i]);
                }
              }
              for (var i = 0; i < reviews.length; i++) {
                let itemresults = items;
                var modreview = itemresults.find(r => r.id === reviews[i].id);
                if (modreview !== undefined && idbAdd == false && modreview.length > 0){
                  if (modreview.name != items[i].name || modreview.comments != items[i].comments || modreview.rating != items[i].rating){
                    // console.log("modifying idb: ", items[i].id);
                    store.delete(items[i].id);
                    store.put(items[i]);
                  }
                }
                if (itemresults.find(r => r.id == reviews[i].id) == undefined){
                  // console.log("removing from idb id: ", reviews[i].id);
                  store.delete(reviews[i].id);
                }
              }
            }
            // console.log("TX COMPLETE");
            return tx.complete;
            callback(null, transaction);
          }).catch(function(error) {
            console.log('Reviews transaction error: ', error);
          });
        }).then(function() {
          // console.log('Reviews database opened and synced')
        }).catch(function(error) {
          console.log('Reviews sync db error: ', error.message);
        });
      }
  }).then(function() {
    console.log('Reviews sync fetch complete');
  }).catch(function(error) {
    console.log('Reviews sync fetch error: ', error.message);
  });
}
/**
 * Fetch all restaurants from resource db if available otherwise fetch from idb
 */
function fetchRestaurants(callback) {
  return dbRestaurantPromise.then(function(db) {
    if (!db) return;
    // fetch data from restaurants
    var index = db.transaction('restaurants')
      .objectStore('restaurants').index('by-date');

    return index.getAll().then(function(messages) {
      callback(null, messages);
    }).catch(function(error) {
      callback(error, null);
    });
  });
  return dbRestaurantPromise.then(function() {
    console.log("fetching restaurants");
  });
}

// Sync resource db and idb
function syncRestaurantsDB(dbURL, dbName, dbPromise) {
  return fetchRestaurants(function(error, restaurants) {
    if(restaurants.length > 0){
      return dbPromise.then(function(db) {
        if (!db) return;
        fetch(dbURL)
          .then(function(response) {
            return response.json();
          }).then(function(items) {
            var tx = db.transaction(dbName, 'readwrite');
            var store = tx.objectStore(dbName);
            // console.log("items length: ", items.length);
            let results = restaurants;
            if (error) {
              callback(error, transaction);
            } else {
              for (var i = 0; i < items.length; i++) {
                let restaurantsresults = restaurants;
                var modrest = restaurantsresults.find(r => r.id == items[i].id);
                if (modrest !== undefined){
                  if (modrest.is_favorite != items[i].is_favorite){
                    // console.log("modifying idb");
                    store.delete(items[i].id);
                    store.put(items[i]);
                  }
                }
                if (restaurantsresults.find(r => r.id == items[i].id) === undefined){
                  // console.log("adding id: ", items[i].id);
                  store.put(items[i]);
                }
              }
              // console.log("restaurants length: ", restaurants.length);
              for (var i = 0; i < restaurants.length; i++) {
                let itemresults = items;
                var modrest = itemresults.find(r => r.id == items[i].id);
                if (modrest !== undefined){
                  if (modrest.is_favorite != items[i].is_favorite){
                    // console.log("modifying idb");
                    store.delete(items[i].id);
                    store.put(items[i]);
                  }
                }
                if (itemresults.find(r => r.id == restaurants[i].id) === undefined){
                  // console.log("removing from idb id: ", restaurants[i].id);
                  store.delete(restaurants[i].id);
                }
              }
            }
            return tx.complete;
            callback(null, transaction);
          }).catch(function(error) {
            console.log('Restaurants transaction error: ', error);
          });
        }).then(function() {
          // console.log('Restaurants database opened and synced')
        }).catch(function(error) {
          console.log('Restaurants sync db error: ', error.message);
        });
      }
  }).then(function() {
    console.log('Restaurants sync fetch complete');
  }).catch(function(error) {
    console.log('Restaurants sync fetch error: ', error.message);
  });
}

// Initial load from resource db to idb
function loadDB(dbURL, dbName, dbPromise) {

  return dbPromise.then(function(db) {
    if (!db) return;
    fetch(dbURL)
      .then(function(response) {
        return response.json();
      }).then(function(items) {
        // console.log('loadDB: ', items);
        var tx = db.transaction(dbName, 'readwrite');
        var store = tx.objectStore(dbName);
        for (var i = 0; i < items.length; i++) {
          store.put(items[i]);
        }
        return tx.complete;
      }).catch(function(error) {
        console.log('Transaction error: ', error);
      });
  }).then(function(){
    console.log('database opened and loaded: ', dbName);
  }).catch(function(error) {
    console.log('Load db error: ', error.message);
  });
}
