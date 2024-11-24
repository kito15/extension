// Background script for handling API communications and data processing

const OPENAI_API_KEY = 'YOUR_OPENAI';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'autofill') {
    autofillForm(request.formData)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Indicates that the response is asynchronous
  }
});

async function autofillForm(formData) {
  const userContext = await getUserContext();
  const responses = {};

  for (const field of formData) {
    const prompt = constructPrompt(field, userContext);
    const apiResponse = await callOpenAI(prompt);
    responses[field.id] = apiResponse;
  }

  return responses;
}

async function getUserContext() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['userInfo'], function(result) {
      if (result.userInfo) {
        resolve({
          ...result.userInfo,
          gender: result.userInfo.gender || "Not specified",
          citizenship: result.userInfo.citizenship || "Not specified",
          workAuthorization: result.userInfo.workAuthorization || "Not specified",
          sponsorship: result.userInfo.sponsorship || "Not specified",
          veteranStatus: result.userInfo.veteranStatus || "Not specified",
          race: result.userInfo.race || "Not specified"
        });
      } else {
        resolve({
          name: "",
          email: "",
          phone: "",
          location: "",
          education: "",
          gender: "Not specified",
          citizenship: "Not specified",
          workAuthorization: "Not specified",
          sponsorship: "Not specified",
          veteranStatus: "Not specified",
          race: "Not specified",
          currentCompany: "",
          linkedinUrl: "",
          portfolioUrl: ""
        });
      }
    });
  });
}

function constructPrompt(field, userContext) {
  // Construct a more detailed prompt for the OpenAI API based on the field and expanded user context
  const contextLines = Object.entries(userContext)
    .filter(([_, value]) => value && value !== "" && value !== "Not specified")
    .map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`);

  const contextString = contextLines.length > 0 ? 
    "Given the following user context:\n" + contextLines.join("\n") :
    "No user context is available.";

  return `${contextString}

    Provide an appropriate response for the field: ${field.label}
    (type: ${field.type}, options: ${JSON.stringify(field.options)})

    Ensure the response is concise and directly relevant to the field. If the field type is a select or radio button, make sure the response matches one of the available options exactly. For location-related fields, note that the user is willing to work hybrid or remote. If no relevant user context is available, leave the response blank.`;
}

async function callOpenAI(prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful assistant that provides appropriate responses for job application fields." },
        { role: "user", content: prompt }
      ],
      max_tokens: 50,
      n: 1,
      temperature: 0.5,
    })
  });

  const data = await response.json();
  return data.choices[0].message.content.trim();
}
