import $ from './jquery-with-plugins';
import moment from 'moment';
import Paginator from './paginator';
import Templates from './templates';
const APIUrl = (endpoint=false) => `/api${endpoint ? endpoint : '/'}`;

const state = {
  // groups offsetter
  g_offset: 0,
  g_limit: 50,
  g_loading: false,
  g_content_end: false,

  u_offset: 0,
  u_limit: 1000,

  group: null,
  total_urls: 0,

  next_urls: function() { return false; },
  prev_urls: function() { return false; }
};

const urls = {
  groups: () => APIUrl(`/groups/list`),
  groupUrls: (gid,o=false) => {
    if(o === false)
      state.u_offset = 0;
    else
      state.u_offset = o;
    return APIUrl(`/group/view/${gid}/urls?limit=${state.u_limit}&offset=${state.u_limit * state.u_offset}`);
  },
  diaries: id => APIUrl(`/diary/url/${id}`),
  groupsList: () => {
    state.g_offset += 1;
    let offset = state.g_offset * state.g_limit;
    return APIUrl(`/groups/list?offset=${offset}&details=1`);
  }
}

function loadGroups() {
  return new Promise((resolve, reject) => {
    $.get(urls.groups(), res => resolve(res), rej => reject(rej), "json");
  });
}

function getURLOffsetRange(loaded = 0) {
  let { u_offset, u_limit, total_urls } = state;
  let total = Math.ceil(total_urls / u_limit);
  let string = `Loaded <strong>${u_offset * u_limit}</strong> to <strong>${(u_offset * u_limit) + loaded}</strong> from <strong>${total_urls}</strong> results.`;
  return { total, string };
}

// detects a ?view={id} item to pre-open url editors
function detectTarget() {
  let ls = window.localStorage.getItem('ek-selected-group');
  let tgt = window.location.search.replace('?','').split('=');
  return new Promise((resolve,reject) => {
    if(tgt) {
      if(tgt.length == 2) {
        let t = tgt[1];
        if(isNaN(t)) {
          // do api call
          return $.get(`/api/group/view/${t}`).done(result => {
            return resolve(result.id);
          });
        } else {
          return resolve(parseInt(t));
        }
      }
    }
    if(ls) {
      return resolve(parseInt(ls));
    } else {
      return reject(false);
    }
  });
}

// loads up the urls for a group
function loadUrlsForGroup(groupId) {
  return new Promise((resolve, reject) => {
    $.get(urls.groupUrls(groupId, false), data => {
      resolve(data);
    }, err => reject(err), "json");
  });
}

// opens a diary for a specific url
function openDiaryForUrl(el, id) {
  window.location = `/diary/${id}`;
}

// returns a list of diaries for a url
function getDiariesForUrl(id) {
  return new Promise((resolve, reject) => {
    $.get(urls.diaries(id), res => resolve(res), err => reject(err), "json")
  });
}

// populates urls for a certain group
function populateUrls(u,el) {

  let range = getURLOffsetRange(u.length);
  range.current = 1;

  $(".url-display-footer p").html(range.string);

  el.empty();

  // creates a url button
  let createUrlButton = e => {
    let li = $("<li />");
    let ta  = $("<textarea />");
    let ic = $("<i class='far fa-atlas'></i>");
    let ar = $("<i class='far fa-angle-right'></i>");
    li.attr('data-filter-value', e.url);
    li.attr('data-url-id', e.id); // MOCK ID
    ta.val(e.url);
    ta.attr('title', e.url);
    ta.attr('disabled', true);
    li.append(ic, ta, ar);
    return li;
  };

  // creates a list of diaries
  let createDiaryList = diaries => {
    let ul = $("<ul class='data-list scroll-context' />");
    diaries.forEach(diary => {
      let { version, datetime, id } = diary;
      let an = $("<a />");
      let li = $("<li />");
      let sp = $("<span class='tag' data-label-prefix='No.' />");
      an.data('diary', diary);
      an.text(moment(datetime).format('LLL'));
      an.attr('href',`/diary/${id}`);
      sp.attr('title',version);
      an.prepend(sp);
      li.append(an);
      ul.append(li);
    });
    return ul;
  };

  if(u.length) {

    u.map(e => createUrlButton(e)).forEach(e => {
      el.append(e);
      // creates a dropdown list for that group, opens on click
      e.on('click', e => {
        e.preventDefault();
        e.stopPropagation();
        let el = $(e.currentTarget);
        getDiariesForUrl(el.data('urlId')).then(diaries => {
          if(!el.hasClass('open')) {

            let ul = createDiaryList(diaries);
            el.after(ul);
            el.addClass('open');

            // add paginator
            const paginator = new Paginator({
              url: urls.diaries(el.data('urlId')),
              limit: 50,
              offset: 0
            });

            let button = $(`
              <li class="paginate"><button class="button">More</button></li>
            `);

            ul.append(button);

            button.find('button').on('click', e => {
              e.preventDefault();
              e.stopPropagation();
              paginator.next();
            });

            paginator.on('payload', data => {
              let list = createDiaryList(data.response);
              list.find('li').each((i,li)=>{
                button.before(li);
                // if 'no records' is shown, remove it
                if(button.find('p').length) button.find('p').remove();
              });
            });

            paginator.on('empty', () => {
              if(!button.find('p').length)
                button.append('<p><i class="fas fa-exclamation-triangle"></i> No records left.</p>');
            });

          } else {

            el.removeClass('open');
            el.next('.data-list').remove();

          }
        });
      });
    });

    state.next_urls = function() {
      if(u.length < state.u_limit) {
        return false;
      } else {
         $.get(urls.groupUrls(state.group, state.u_offset+1)).done(n => {
           populateUrls(n.urls,el);
         });
       }
    }

    state.prev_urls = function() {
      if(state.u_offset == 0) return false;
      $.get(urls.groupUrls(state.group, state.u_offset-1)).done(n => {
        populateUrls(n.urls,el);
      });
    }

  } else {
    // display a message that the list is empty
    let li = $(document.createElement('li'));
    li.text('There are no urls in this group.');
    el.append(li);
  }
}

function initUrlGroupView($el) {

  const pre = [];
  let $groupFilter = $el.find('#filter-group-names');
  let $groups = $el.find('.url-groups');
  let $moreGroups = $el.find('#load-more-groups');
  let $urls = $el.find('.url-list');
  let $diaryFilter = $el.find('#filter-url-content');
  let $paginateNext = $el.find('.url-display-footer a[href="diaries:next"]');
  let $paginatePrev = $el.find('.url-display-footer a[href="diaries:previous"]');

  let linkClickHandler = e => {

    e.preventDefault();

    $groups.find('a').removeClass('active');
    $(e.currentTarget).addClass('active');

    let id = $(e.currentTarget).attr('href').split(':')[1];
    let total = $(e.currentTarget).data('groupTotal');
    window.localStorage.setItem('ek-selected-group', id);

    loadUrlsForGroup(id).then(d => {
      state.group = id;
      state.total_urls = parseInt(total);
      populateUrls(d.urls, $urls);
    }).catch(err => console.log(err));

    return false;
  }

  return new Promise((resolve, reject) => {

    $el.find('.url-groups a[href^="open:"]').on('click', linkClickHandler);

    $el.find('.url-groups li').each(function() {
      $(this).find('.events-badge').on('click', function() {
        let gn = $(this).parents('li').data('name');
        window.location = `/?group=${gn}`;
      });
    });

    $groupFilter.on('keyup', e => {
      let val = $(e.currentTarget).val();
      $el.find('[data-group-list]').filterList(val);
    });

    $diaryFilter.on('keyup', e => {
      let val = $(e.currentTarget).val();
      $el.find('[data-diary-list]').filterList(val);
    });

    $paginateNext.on('click', e => {
      e.preventDefault();
      if(state.next_urls) state.next_urls();
    });

    $paginatePrev.on('click', e => {
      e.preventDefault();
      if(state.next_urls) state.prev_urls();
    });

    let loadMoreGroups = () => {
      if(state.g_loading === true || state.g_content_end === true) return;
      state.g_loading = true;
      $.get(urls.groupsList()).done(groups => {
        if(groups.length) {
          groups.forEach(group => {
            let g = $(Templates.groupListItem(group));
            $el.find('.url-groups').append(g);
            g.find('a').on('click', linkClickHandler);
            g.find('.events-badge').on('click', function() {
              let gn = $(this).parents('li').data('name');
              window.location = `/?group=${gn}`;
            });
          });
          if(groups.length < state.g_limit)
            state.g_content_end = true;
        } else {
          state.g_content_end = true;
        }
        state.g_loading = false;
      });
    }

    $moreGroups.on('click', e => {
      e.preventDefault();
      loadMoreGroups();
    });

    $(".url-groups").on('scroll', () => {
      if($(".url-groups").scrollTop() + $(window).height() > $(".url-groups")[0].scrollHeight)
        loadMoreGroups();
    });

    // openAt handler
    detectTarget().then(show => {
      if($(`.url-groups a[href="open:${show}"]`).length) {
        // if menu item for group is existent, just 'click' it.
        $(`.url-groups a[href="open:${show}"]`).click();
      } else {
        // if not, load it using the api
        loadUrlsForGroup(show).then(d => {
          populateUrls(d.urls, $urls);
        }).catch(err => console.log(err));
      }
    }).catch(() => {
      $el.find('.url-groups a[href^="open:"]').eq(0).click();
    });

    resolve();

  });
}

export { initUrlGroupView };
