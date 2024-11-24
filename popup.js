document.addEventListener('DOMContentLoaded', function() {
  const userInfoForm = document.getElementById('userInfoForm');
  const autofillBtn = document.getElementById('autofillBtn');
  const statusDiv = document.getElementById('status');

  // Load saved user information
  chrome.storage.sync.get(['userInfo'], function(result) {
    if (result.userInfo) {
      Object.keys(result.userInfo).forEach(key => {
        const input = document.getElementById(key);
        if (input) {
          if (input.tagName === 'SELECT') {
            input.value = result.userInfo[key] || '';
          } else {
            input.value = result.userInfo[key];
          }
        }
      });
    }
  });

  // Set default value for gender if not present
  const genderSelect = document.getElementById('gender');
  if (genderSelect && !genderSelect.value) {
    genderSelect.value = '';
  }

  // Save user information
  userInfoForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const userInfo = {};
    new FormData(userInfoForm).forEach((value, key) => {
      userInfo[key] = value;
    });
    
    chrome.storage.sync.get(['resumeContent'], function(result) {
      userInfo.resumeContent = result.resumeContent || '';
      
      chrome.storage.sync.set({userInfo: userInfo}, function() {
        statusDiv.textContent = "Information saved successfully!";
        setTimeout(() => {
          statusDiv.textContent = "";
        }, 3000);
      });
    });
  });

  function checkContentScriptReady(tabId, callback) {
    chrome.tabs.sendMessage(tabId, {action: "checkReady"}, function(response) {
      if (chrome.runtime.lastError) {
        setTimeout(() => checkContentScriptReady(tabId, callback), 100); // Retry after 100ms
      } else {
        callback();
      }
    });
  }

  autofillBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      checkContentScriptReady(tabs[0].id, function() {
        chrome.tabs.sendMessage(tabs[0].id, {action: "getFormFields"}, function(response) {
          if (chrome.runtime.lastError) {
            console.error('Error:', chrome.runtime.lastError);
            statusDiv.textContent = "Error: " + chrome.runtime.lastError.message;
            return;
          }
          if (response && response.formFields) {
            statusDiv.textContent = "Autofilling...";
            chrome.runtime.sendMessage({action: "autofill", formData: response.formFields}, function(response) {
              if (chrome.runtime.lastError) {
                console.error('Error:', chrome.runtime.lastError);
                statusDiv.textContent = "Error: " + chrome.runtime.lastError.message;
                return;
              }
              if (response.success) {
                console.log('Received data from background:', response.data);
                chrome.tabs.sendMessage(tabs[0].id, {action: "autofill", data: response.data}, function(autofillResponse) {
                  if (chrome.runtime.lastError) {
                    console.error('Error:', chrome.runtime.lastError);
                    statusDiv.textContent = "Error: " + chrome.runtime.lastError.message;
                    return;
                  }
                  if (autofillResponse && autofillResponse.success) {
                    statusDiv.textContent = "Autofill complete!";
                  } else {
                    statusDiv.textContent = "Error autofilling form.";
                  }
                });
              } else {
                statusDiv.textContent = "Error: " + (response.error || "Unknown error occurred");
              }
            });
          } else {
            statusDiv.textContent = "No form fields found.";
          }
        });
      });
    });
  });

  // Resume file handling
  const resumeFile = document.getElementById('resumeFile');
  const resumePreview = document.getElementById('resumePreview');

  resumeFile.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const content = e.target.result;
        // Store the resume content
        chrome.storage.sync.set({resumeContent: content}, function() {
          statusDiv.textContent = "Resume uploaded successfully!";
          setTimeout(() => {
            statusDiv.textContent = "";
          }, 3000);
        });
        // Show preview
        resumePreview.innerHTML = '<div class="preview-message">Resume uploaded</div>';
      };
      reader.readAsText(file);
    }
  });

  // Load saved resume content
  chrome.storage.sync.get(['resumeContent'], function(result) {
    if (result.resumeContent) {
      resumePreview.innerHTML = '<div class="preview-message">Resume already uploaded</div>';
    }
  });

  // Tab Navigation
  const tabs = document.querySelectorAll('.tab-button');
  const contents = document.querySelectorAll('.tab-content');
  const dots = document.querySelectorAll('.progress-dot');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const saveBtn = document.getElementById('saveBtn');
  let currentTab = 0;

  function showTab(index) {
    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));

    tabs[index].classList.add('active');
    contents[index].classList.add('active');
    dots[index].classList.add('active');

    // Update navigation buttons
    prevBtn.style.display = index === 0 ? 'none' : 'flex';
    nextBtn.style.display = index === tabs.length - 1 ? 'none' : 'flex';
    saveBtn.classList.toggle('visible', index === tabs.length - 1);

    currentTab = index;
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => showTab(index));
  });

  prevBtn.addEventListener('click', () => {
    if (currentTab > 0) showTab(currentTab - 1);
  });

  nextBtn.addEventListener('click', () => {
    if (currentTab < tabs.length - 1) showTab(currentTab + 1);
  });
});
