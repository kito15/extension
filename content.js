// Content script for interacting with the job application page

let formFields = [];
let isReady = false;
let dynamicFieldsQueue = new Set();

console.log('Content script loaded');

function identifyInputFields() {
  // Enhanced selector to catch both standard and custom elements
  const inputs = document.querySelectorAll(`
    input, select, textarea,
    [role="textbox"], [role="combobox"], [role="listbox"],
    [role="radio"], [role="checkbox"], [contenteditable="true"],
    [data-testid*="input"], [data-testid*="select"], [data-testid*="checkbox"],
    .form-control, .input, .select, .textarea
  `);
  
  formFields = Array.from(inputs).map(input => {
    const field = {
      id: input.id || input.name || generateUniqueId(input),
      type: determineFieldType(input),
      label: getFieldLabel(input),
      options: getFieldOptions(input),
      required: input.required || input.getAttribute('aria-required') === 'true',
      customAttributes: getCustomAttributes(input),
      reactProps: extractReactProps(input),
      eventHandlers: identifyRequiredEvents(input)
    };
    
    if (field.type === 'file') {
      field.isFileInput = true;
    }
    
    console.log('Identified field:', field);
    return field;
  });
  
  identifyDynamicFields();
  console.log('Total fields identified:', formFields.length);
}

function determineFieldType(input) {
  // Check for custom React/framework components first
  const role = input.getAttribute('role');
  const dataTestId = input.getAttribute('data-testid') || '';
  const className = input.className || '';
  
  if (role) {
    switch (role) {
      case 'combobox': return 'select-one';
      case 'listbox': return 'select-multiple';
      case 'radio': return 'radio';
      case 'checkbox': return 'checkbox';
      case 'textbox': return input.getAttribute('aria-multiline') === 'true' ? 'textarea' : 'text';
    }
  }

  // Handle date/time inputs
  if (input.type === 'date' || input.type === 'datetime-local' || 
      dataTestId.includes('date') || className.includes('datepicker')) {
    return 'date';
  }

  return input.type || input.tagName.toLowerCase();
}

function getCustomAttributes(input) {
  return {
    reactId: input.getAttribute('data-reactid'),
    testId: input.getAttribute('data-testid'),
    automation: input.getAttribute('data-automation'),
    customEvents: input.getAttribute('data-events')
  };
}

function extractReactProps(element) {
  // Extract React internal properties
  const reactKey = Object.keys(element).find(key => key.startsWith('__reactProps'));
  return reactKey ? element[reactKey] : null;
}

function identifyRequiredEvents(input) {
  const events = ['click', 'focus', 'mousedown', 'mouseup', 'change', 'input'];
  return events.filter(event => {
    const prop = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), `on${event}`);
    return prop && prop.get;
  });
}

function generateUniqueId(input) {
  const index = Array.from(document.querySelectorAll('*')).indexOf(input);
  const attributes = Array.from(input.attributes)
    .map(attr => `${attr.name}-${attr.value}`)
    .join('_');
  return `generated_id_${index}_${attributes}`;
}

function getFieldLabel(input) {
  // Try multiple approaches to find the label
  const strategies = [
    () => input.labels?.[0]?.textContent.trim(),
    () => input.getAttribute('aria-label'),
    () => document.querySelector(`[for="${input.id}"]`)?.textContent.trim(),
    () => input.placeholder,
    () => getNearbyText(input),
    () => input.getAttribute('name'),
    () => input.getAttribute('data-testid')?.replace(/-/g, ' '),
    () => input.id?.replace(/-/g, ' ')
  ];

  for (const strategy of strategies) {
    const result = strategy();
    if (result) return result;
  }
  return '';
}

function getNearbyText(element) {
  const range = 100; // Increased range for better context
  let currentNode = element;
  let text = '';
  
  // Look for text in siblings and parent nodes
  while (currentNode && text.length < range) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      text = (currentNode.textContent.trim() + ' ' + text).trim();
    }
    currentNode = currentNode.previousSibling || currentNode.parentNode;
  }
  
  return text.substring(0, range).trim();
}

function getFieldOptions(input) {
  if (input.tagName === 'SELECT') {
    return Array.from(input.options).map(option => ({
      text: option.text,
      value: option.value
    }));
  }
  
  if (input.type === 'radio' || input.type === 'checkbox') {
    const name = input.name;
    const options = document.querySelectorAll(`
      input[name="${name}"],
      [role="${input.type}"][name="${name}"],
      [data-testid*="${name}"]
    `);
    return Array.from(options).map(option => ({
      text: getFieldLabel(option),
      value: option.value || option.getAttribute('data-value')
    }));
  }
  
  return null;
}

function setupMutationObserver() {
  const observer = new MutationObserver((mutations) => {
    let shouldUpdate = false;
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList' || mutation.type === 'attributes') {
        const hasNewInputs = Array.from(mutation.addedNodes).some(node =>
          node.querySelectorAll && (
            node.matches?.('input, select, textarea, [role], [data-testid]') ||
            node.querySelectorAll('input, select, textarea, [role], [data-testid]').length > 0
          )
        );
        
        if (hasNewInputs) {
          shouldUpdate = true;
          break;
        }
      }
    }
    
    if (shouldUpdate) {
      setTimeout(() => {
        identifyInputFields();
        processDynamicFieldsQueue();
      }, 500); // Allow time for React/framework to fully render
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'data-*']
  });
}

function identifyDynamicFields() {
  const dynamicContainers = document.querySelectorAll('[data-dynamic], [data-conditional]');
  dynamicContainers.forEach(container => {
    const fields = container.querySelectorAll('input, select, textarea, [role]');
    fields.forEach(field => dynamicFieldsQueue.add(field));
  });
}

function processDynamicFieldsQueue() {
  dynamicFieldsQueue.forEach(field => {
    if (document.body.contains(field)) {
      const fieldData = formFields.find(f => f.id === field.id);
      if (!fieldData) {
        formFields.push({
          id: field.id || generateUniqueId(field),
          type: determineFieldType(field),
          label: getFieldLabel(field),
          options: getFieldOptions(field),
          required: field.required || field.getAttribute('aria-required') === 'true',
          isDynamic: true
        });
      }
    }
  });
  dynamicFieldsQueue.clear();
}

async function autofillFields(data) {
  console.log('Autofilling fields with data:', data);
  
  for (const field of formFields) {
    const input = document.getElementById(field.id) || 
                 document.getElementsByName(field.id)[0] ||
                 document.querySelector(`[data-testid="${field.id}"]`);
                 
    if (!input || !data[field.id]) {
      console.log(`No input found for field ${field.id} or no data available`);
      continue;
    }

    try {
      await fillField(input, field, data[field.id]);
    } catch (error) {
      console.error(`Error filling field ${field.id}:`, error);
    }
  }
}

async function fillField(input, field, value) {
  console.log(`Filling field ${field.id} with value ${value}`);
  
  // Handle file inputs
  if (field.type === 'file') {
    console.log(`Skipping file input field ${field.id}. User needs to manually upload the file.`);
    return;
  }

  // Ensure the field is interactive
  await ensureFieldIsInteractive(input);

  // Handle different field types
  switch (field.type) {
    case 'select-one':
    case 'select-multiple':
      await handleSelectField(input, value);
      break;
      
    case 'radio':
    case 'checkbox':
      await handleToggleField(input, field, value);
      break;
      
    case 'date':
    case 'datetime-local':
      await handleDateField(input, value);
      break;
      
    default:
      await handleTextField(input, value);
  }

  // Trigger necessary events
  const events = ['change', 'input', 'blur'];
  events.forEach(eventType => {
    input.dispatchEvent(new Event(eventType, { bubbles: true }));
  });
}

async function ensureFieldIsInteractive(input) {
  // Scroll field into view
  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await new Promise(resolve => setTimeout(resolve, 100));

  // Simulate user interaction
  input.dispatchEvent(new Event('focus', { bubbles: true }));
  input.dispatchEvent(new MouseEvent('mousedown'));
  input.dispatchEvent(new MouseEvent('mouseup'));
  input.dispatchEvent(new MouseEvent('click'));
  
  // Wait for any dynamic content to load
  await new Promise(resolve => setTimeout(resolve, 200));
}

async function handleSelectField(input, value) {
  // Handle both native and custom select elements
  if (input.tagName === 'SELECT') {
    const option = Array.from(input.options).find(opt => 
      opt.text.toLowerCase().includes(value.toLowerCase()) ||
      opt.value.toLowerCase().includes(value.toLowerCase())
    );
    if (option) input.value = option.value;
  } else {
    // Custom select implementation
    input.click(); // Open the dropdown
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const options = document.querySelectorAll('[role="option"], .select-option');
    const matchingOption = Array.from(options).find(opt => 
      opt.textContent.toLowerCase().includes(value.toLowerCase())
    );
    
    if (matchingOption) matchingOption.click();
  }
}

async function handleToggleField(input, field, value) {
  const isCustom = !['input'].includes(input.tagName.toLowerCase());
  
  if (isCustom) {
    input.click();
  } else {
    if (field.type === 'checkbox') {
      input.checked = value.toLowerCase() === 'true';
    } else {
      const radio = document.querySelector(`
        input[name="${field.id}"][value="${value}"],
        [role="radio"][name="${field.id}"][data-value="${value}"]
      `);
      if (radio) radio.click();
    }
  }
}

async function handleDateField(input, value) {
  // Convert value to expected format
  const date = new Date(value);
  const formattedDate = date.toISOString().split('T')[0];
  
  if (input.type === 'date') {
    input.value = formattedDate;
  } else {
    // Handle custom date pickers
    input.click(); // Open the picker
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const dateElements = document.querySelectorAll('.date-option, [data-date]');
    const matchingDate = Array.from(dateElements).find(el => 
      el.textContent.includes(date.getDate()) &&
      el.textContent.includes(date.getFullYear())
    );
    
    if (matchingDate) matchingDate.click();
  }
}

async function handleTextField(input, value) {
  // Handle both native and custom text inputs
  if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
    input.value = value;
  } else {
    // Handle contenteditable or custom inputs
    input.textContent = value;
  }
}

// Initialize
identifyInputFields();
setupMutationObserver();

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  if (request.action === 'checkReady') {
    sendResponse({ ready: true });
  } else if (request.action === 'getFormFields') {
    console.log('Sending form fields:', formFields);
    sendResponse({ formFields: formFields });
  } else if (request.action === 'autofill') {
    console.log('Autofilling fields with data:', request.data);
    autofillFields(request.data).then(() => {
      sendResponse({ success: true });
    });
  }
  return true;
});

// Notify that the content script is ready
chrome.runtime.sendMessage({ action: 'contentScriptReady' });
