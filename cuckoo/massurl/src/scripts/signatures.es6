import $ from './jquery-with-plugins';
import Handlebars from 'handlebars';

const state = {
  formParent: null,
  sigList: null
}

Handlebars.registerHelper('eq', (p,m,opts) => p == m ? opts.fn() : '');
Handlebars.registerHelper('keys', (o,opts) => {
  let r = "";
  Object.keys(o).forEach(k => r += opts.fn(k));
  return r;
});
Handlebars.registerHelper('is-selected', (o,t) => {
  if(Object.keys(o)[0] == t) {
    return 'selected';
  } else {
    return '';
  }
});

// signature list item template
const $SIG_LIST_ITEM = (data={}) => Handlebars.compile(`
  <li>
    <a href="load:{{id}}">{{name}}</a>
  </li>
`)(data);

const $SIG_INPUT_ROW = (data={}) => Handlebars.compile(`
  {{#each this}}
    <div class="multi-input-row" data-sig-fields>
      <div class="multi-input-row__select">
        <div class="configure-block__control--wrapper mini caret">
          <select class="configure-block__control">
            <option value="any" {{is-selected this 'any'}}>Any</option>
            <option value="must" {{is-selected this 'must'}}>Must</option>
          </select>
        </div>
      </div>
      <div class="multi-input-row__fields">
        {{#each this}}
          {{#each this}}
              <input type="text" class="configure-block__control inline mini" value="{{this}}" />
            {{else}}
              <input type="text" class="configure-block__control inline mini" />
          {{/each}}
          {{else}}
            <input type="text" class="configure-block__control inline mini" />
        {{/each}}
      </div>
      <div class="multi-input-row__actions">
        <a href="#" data-remove-row title="Remove row"><i class="fas fa-times"></i></a>
      </div>
    </div>
  {{/each}}
`)(data);

// initialise helper for existing signature rows inside a template.
// initializing has to be done in inputRow()
Handlebars.registerHelper('input-row', (sig,opts) => {
  return new Handlebars.SafeString($SIG_INPUT_ROW(sig));
});

// signature form template
const $SIG_FORM = (data={}) => Handlebars.compile(`

  <h2>{{signature.name}}</h2>

  <div class="configure-block__container">

    {{#if meta.new}}
      <div class="configure-block">
        <label for="signature-name" class="configure-block__label">Signature name</label>
        <p class="configure-block__description">A unique name for this signature</p>
        <input class="configure-block__control" id="signature-name" name="signature-name" placeholder="Type name" required />
      </div>
    {{/if}}

    <div class="configure-block">
      <h4 class="configure-block__label">Enabled</h4>
      <p class="configure-block__description">Match this signature</p>
      <div class="configure-block__control checkbox">
        <input type="checkbox" id="signature-enabled" {{#if signature.enabled}}checked{{/if}} />
        <label for="signature-enabled">Enable</label>
      </div>
    </div>

    <div class="configure-block" {{#unless signature.enabled}}hidden{{/unless}}>
      <label class="configure-block__label" for="signature-level">Alert level</label>
      <p class="configure-block__description">Match level target</p>
      <div class="configure-block__control--wrapper mini caret">
        <select class="configure-block__control" name="signature-level" id="signature-level">
          <option value="1" {{#eq signature.level 1}}selected{{/eq}}>1</option>
          <option value="2" {{#eq signature.level 2}}selected{{/eq}}>2</option>
          <option value="3" {{#eq signature.level 3}}selected{{/eq}}>3</option>
        </select>
      </div>
    </div>

  </div>

  <div class="flex-v">
    <div class="configure-block free">
      <h4 class="configure-block__label">Content</h4>
      <p class="configure-block__description">Create signatures. Assign an operator (any or must), followed by strings that should match the signature. Click 'add row' to add many lines.</p>
      <p class="configure-block__hotkeys">
        controls:
        <span>&#9166; add string</span>
        <span>&#9003; delete string</span>
      </p>
    </div>
    <div class="full-block tabbed">
      <ul class="tabbed-nav">
        {{#each signature.content}}
          <li><a {{#eq @index 0}}class="active"{{/eq}} href="tab:{{@key}}">{{@key}}</a></li>
        {{/each}}
      </ul>
      <div class="tabbed-content">
        {{#each signature.content}}
          <div class="tabbed-tab {{#eq @index 0}}active{{/eq}}" data-tab="{{@key}}">
            {{input-row this}}
            <div class="multi-input-row">
              <a href="#" data-create-row>Add row</a>
            </div>
          </div>
        {{/each}}
      </div>
    </div>
  </div>

  <footer {{#if meta.new}}class="align-right"{{/if}}>
    {{#unless meta.new}}
      <button id="delete-signature">Delete</button>
    {{/unless}}
    <button id="save-signature">{{#if meta.new}}Create{{else}}Save{{/if}}</button>
  </footer>

`)(data);

const api = {
  list: () => $.get('/api/signatures/list'),
  get: id => $.get(`/api/signature/${id}`),
  create: data => $.jpost('/api/signature/add', data),
  update: (id,data) => $.jpost(`/api/signature/update/${id}`, data),
  delete: id => $.post(`/api/signature/delete/${id}`),
  run: id => $.post(`/api/signature/run/${id}`)
};

function loadSignature(id=false) {
  return new Promise((res, rej) => {
    if(id) {
      api.get(id).done(sig => res(sig)).fail(err => rej(err));
    } else {
      api.list().done(sigs => res(sigs)).fail(err => rej(err));
    }
  });
};

function createSignature(data) {
  return new Promise((res, rej) => {
    // validation can be done here
    api.create(data).done(response => res(response)).fail(err => rej(err));
  });
};

function updateSignature(id, data) {
  return new Promise((res, rej) => {
    api.update(id,data).done(response => res(response)).fail(err => rej(err));
  });
};

function deleteSignature(id) {
  return new Promise((res, rej) => {
    api.delete(id).done(response => res(response)).fail(err => rej(err));
  });
};

// input row handlers
function inputRow(row) {

  let createInput = () => $(Handlebars.compile(`<input type="text" class="configure-block__control inline mini" />`)({}));

  let keyupHandler = e => {
    let target = e.currentTarget;
    switch(e.keyCode) {
      case 13:
        if(target.value.length) {
          if($(target).next().prop("tagName") == "INPUT") {
            // focus next input if next element is an input
            $(target).next().focus();
          } else {
            // else, create another input
            let inp = createInput();
            $(target).after(inp);
            inp.on('keyup', keyupHandler);
            inp.focus();
          }
        }
      break;
      case 8:
        if(target.value.length == 0) {
          if($(target).prev().prop('tagName') == 'INPUT') {
            $(target).prev().focus();
          } else if ($(target).next().prop('tagName') == 'INPUT') {
            $(target).next().focus();
          }
          if($(target).prev().length !== 0)
            $(target).remove();
        }
      break;
    }
  }

  // removes a row
  let removeRowHandler = e => {
    e.preventDefault();
    $(e.currentTarget).parents('.multi-input-row').remove();
  }

  $(row).find('input[type="text"]').on('keyup', keyupHandler);
  $(row).find('[data-remove-row]').on('click', removeRowHandler);
}

function getSignatureValues() {
  let { formParent } = state;
  let ret = {};
  formParent.find('.tabbed-tab').each((i,tab) => {
    let $tab = $(tab);
    ret[$tab.data('tab')] = [];
    $tab.find('[data-sig-fields]').each((i,fields) => {
      let entry = {};
      let type = $(fields).find('select').val()
      entry[type] = [];
      $(fields).find('input[type="text"]').each((i,inp) => {
        if(inp.value.length > 0)
          entry[type].push(inp.value);
      });
      ret[$tab.data('tab')].push(entry);
    });
  });
  return ret;
}

function renderForm(signature, meta={}) {

  let { formParent, sigList } = state;
  let html = $SIG_FORM({signature,meta});
  formParent.html(html);

  // store the required input fields into object to serialize later on
  const fields = {
    name: formParent.find('#signature-name'),
    enabled: formParent.find('#signature-enabled'),
    level: formParent.find('#signature-level')
  }

  // enabled/disabled will toggle 'level' input
  formParent.find("#signature-enabled").on('change', e => {
    formParent.find("#signature-level")
      .parents('.configure-block')
      .prop('hidden', !$(e.currentTarget).is(':checked'));
  });

  // save or update signature
  formParent.find('#save-signature').on('click', e => {
    e.preventDefault();
    let serializeValues = () => {
      return {
        name: fields.name.val(),
        enabled: fields.enabled.is(':checked'),
        level: parseInt(fields.level.val()),
        content: getSignatureValues()
      }
    }
    if(meta.new) {
      // POST new signature
      createSignature(serializeValues()).then(response => {
        let listItem = $($SIG_LIST_ITEM({id:response.signature_id,name:fields.name.val()}));
        state.sigList.append(listItem);
        listItem.find('a').on('click', sigClickHandler).click();
      }).catch(err => console.log(err));
    } else {
      // UPDATE signature
      let values = serializeValues();
      delete values.name;
      updateSignature(signature.id, values).then(response => {
        // signature updated
      }).catch(err => console.log(err));
    }
  });

  // delete signature
  formParent.find('#delete-signature').on('click', e => {
    deleteSignature(signature.id).then(response => {
      sigList.find(`a[href="load:${signature.id}"]`).parents('li').remove();
      formParent.empty();
    }).catch(err => console.log(err));
  });

  // initialize sig tabs
  formParent.find('.tabbed-nav a').on('click', e => {
    e.preventDefault();
    let target = $(e.currentTarget).attr('href').split(':')[1];
    $(e.currentTarget).parents('ul').find('a').removeClass('active');
    $(e.currentTarget).addClass('active');
    $(e.currentTarget).parents('.tabbed').find('[data-tab]').removeClass('active');
    $(e.currentTarget).parents('.tabbed').find(`[data-tab='${target}']`).addClass('active');
  });

  // initialize signature editor rows - new
  formParent.find('.tabbed-tab [data-create-row]').on('click', e => {
    e.preventDefault();
    let $row = $($SIG_INPUT_ROW({
      any: []
    }));
    $(e.currentTarget).parent().before($row);
    inputRow($row);
  });

  // initialize signature editor rows - existing
  formParent.find('.tabbed-tab .multi-input-row').each((i,el) => inputRow(el));

};

let sigClickHandler = e => {
  e.preventDefault();
  let link = $(e.currentTarget);
  let id = link.attr('href').split(':')[1];
  loadSignature(id).then(sig => {
    link.parents('ul').find('.active').removeClass('active');
    link.addClass('active');
    renderForm(sig,{new:false});
  }).catch(err => console.log(err));
};

function initSignatures($el) {

  state.formParent = $("[data-signatures-form]");
  state.sigList = $("[data-signatures-list]");

  return new Promise((resolve, reject) => {

    // create new signature button - populates form
    $("#create-new-signature").on('click', e => {
      renderForm({
        name: 'New signature',
        enabled: false,
        level: 1,
        content: {
          requests: [],
          responsedata: [],
          requestdata: [],
          javascript: []
        }
      }, { new: true });
      state.sigList.find('.active').removeClass('active');
    });

    // load signature - populates form with existing signatures
    loadSignature(false).then(signatures => {
      signatures.forEach(sig => {
        let listItem = $($SIG_LIST_ITEM(sig));
        state.sigList.append(listItem);
      });
      state.sigList.find('a').on('click', sigClickHandler);
    }).catch(err => console.log(err));

    resolve();
  });
};

export { initSignatures };
