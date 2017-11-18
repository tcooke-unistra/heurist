$(document).ready(
function() 
{
/* Necessary to do this stuff BEFORE LOAD -- other windows have dibs on our onload handler, they will get in before we get a chance */
            window.HEURIST.parameters = top.HEURIST.parseParams(location.search);

            var recID;
            var rectypeID = parseInt(window.HEURIST.parameters["rectype"]);
            if (parent.HEURIST  &&  parent.HEURIST.edit && parent.HEURIST.edit.record) {
                recID = parent.HEURIST.edit.record.recID;
            }else{
                if (! parent.HEURIST) parent.HEURIST = {};
                if (! parent.HEURIST.edit) parent.HEURIST.edit = {};
                if (! parent.HEURIST.edit.record) parent.HEURIST.edit.record = {};
                parent.HEURIST.edit.record.rectypeID = rectypeID;
            }

            renderInputs(recID, rectypeID);    
    
                // Invoked when this frame is made visible.
                //repalce to jquery top.HEURIST.edit.calendarViewer = calendarViewer;

                // Find the first required input and focus it.
                var inputs = window.HEURIST.inputs || [];

                var firstInput = null, firstRequiredInput = null, firstEmptyRequiredInput = null;
                for (var i=0; i < inputs.length; ++i) {
                    if (inputs[i].inputs && inputs[i].inputs[0].style.display == "none") continue;

                    if (firstInput == null)
                        firstInput = inputs[i];
                    if (firstRequiredInput == null && inputs[i].required == "required")
                        firstRequiredInput = inputs[i];
                    if (firstEmptyRequiredInput == null && inputs[i].required == "required" && ! inputs[i].verify())
                        firstEmptyRequiredInput = inputs[i];
                }

                var elt;
                if (firstEmptyRequiredInput) elt = firstEmptyRequiredInput.inputs[0];
                else if (firstRequiredInput) elt = firstRequiredInput.inputs[0];
                    else if (firstInput) elt = firstInput.inputs[0];

                if (elt) setTimeout(function() { try { elt.focus(); } catch (e) { } }, 0);
                
          
            document.forms[0].heuristSubmit = function() {
                var checkSimilarElement = document.getElementById("check-similar");
                if ((! parent.HEURIST.edit.record.bibID  ||  parent.HEURIST.edit.record.isTemporary)  &&  ! parent.HEURIST.edit.record.forceSave) {
                    if (! checkSimilarElement) {
                        checkSimilarElement = document.createElement("input");
                        checkSimilarElement.type = "hidden";
                        checkSimilarElement.name = "check-similar";
                        checkSimilarElement.id = "check-similar";
                        document.forms[0].appendChild(checkSimilarElement);
                    }
                    checkSimilarElement.value = top.HEURIST.util.getDisplayPreference("findFuzzyMatches")==='true'?1:0;
                }
                else if (checkSimilarElement) {
                    checkSimilarElement.parentNode.removeChild(checkSimilarElement);
                }

                top.HEURIST.util.xhrFormSubmit(document.forms[0], handleSaved);
            };          
          
                
}
);

            function setRectype(rftID) {
                parent.HEURIST.edit.record.rectype = parent.HEURIST.rectypes.names[rftID];
                renderInputs(parent.HEURIST.edit.record.bibID, rftID);

                changed();
            }
            function setWorkgroupProperties(wg, wgVis) {
                var wgElement = document.getElementById("rec_owner");
                if (! wgElement) {
                    wgElement = document.createElement("input");
                    wgElement.type = "hidden";
                    wgElement.name = "rec_owner";
                    wgElement.id = "rec_owner";
                    document.forms[0].appendChild(wgElement);
                }
                wgElement.value = wg >= 0 ? wg : "";

                var wgVisElement = document.getElementById("rec_visibility");
                if (! wgVisElement) {
                    wgVisElement = document.createElement("input");
                    wgVisElement.type = "hidden";
                    wgVisElement.name = "rec_visibility";
                    wgVisElement.id = "rec_visibility";
                    document.forms[0].appendChild(wgVisElement);
                }
                wgVisElement.value = wgVis? wgVis : "";

                changed();
            }


            function changed() {
                if (parent == top) top.HEURIST.edit.changed("public");
                else if (parent.HEURIST.edit.changed)
                    parent.HEURIST.edit.changed("public");
            }
            function unchanged() {
                if (parent == top) top.HEURIST.edit.unchanged("public");
                else if (parent.HEURIST.edit.unchanged)
                    parent.HEURIST.edit.unchanged("public");
            }
            function handleSaved(json) {
                //console.log(json);
                var vals = eval(json.responseText);
                if (! vals) {
                    //parent.HEURIST = null;
                    window.location.reload();    // no changes to save ... make with the flishy-flashy
                    return;
                }

                if (vals.error) {
                    alert("Error occured while saving record details: <br> " + vals.error);
                    return;
                }

                if (! vals.matches) {
                    // regular case -- we get back an object containing updates to the record details
                    for (var i in vals){
                        parent.HEURIST.edit.record[i] = vals[i];
                    }
                    //parent.HEURIST = null;
                    window.location.reload();
                }else {
                    // we have been supplied with a list of biblio records that look like this one
                    if (parent.popupDisambiguation) parent.popupDisambiguation(vals.matches);
                }
            }


            function renderInputs(bibID, rectype) {
                // Clear out any existing inputs

                var allInputs = document.getElementById("all-inputs");
                while (allInputs.childNodes.length > 0)
                    allInputs.removeChild(allInputs.childNodes[0]);

                var showAllDiv = document.getElementById("show-all-div");
                if (showAllDiv)
                    showAllDiv.parentNode.removeChild(showAllDiv);

                var innerDims = top.HEURIST.util.innerDimensions(window);
                var userCanEdit = parent.HEURIST.edit.userCanEdit();
                if (!userCanEdit) {
                    allInputs.className = allInputs.className + " readonly";
                }

                if (bibID) {
                    if (! parent.HEURIST.edit.record  ||  ! parent.HEURIST.edit.record.bibID) {    // shouldn't get here -- catch it at the parent frame
                        return;
                    }

                    var record = parent.HEURIST.edit.record;
                    //top.HEURIST
                    var inputs = top.HEURIST.edit.createInputsForRectype(bibID,record.rectypeID, record.bdValuesByType, allInputs);

                    var extrasHeader = renderExtraDataHeader(allInputs);
                    //top.HEURIST
                    var extraInputs = top.HEURIST.edit.createInputsNotForRectype(bibID,record.rectypeID, record.bdValuesByType, allInputs);
                    if (extraInputs.length > 0) {
                        for (var i=0; i < extraInputs.length; ++i) {
                            inputs.push(extraInputs[i]);
                        }
                        if (extrasHeader) {
                            extrasHeader.className = extrasHeader.className.replace(/hidden/g,"");
                        }
                    }


                    if (userCanEdit) {
                        renderAdditionalDataSection(allInputs, bibID, record.rectypeID, record.bdValuesByType);
                    }

                    //top.HEURIST
                    top.HEURIST.edit.setAllInputsReadOnly(!userCanEdit);

                    if (! top.document.getElementById("notes")) {
                        var width = 200;
                        var height = 400;
                        var bottom = 16;
                        var right = 16;

                        // Find some notes to drop in the scratchpad ... traipse up the window hierarchy
                        var noteText = record.notes;
                        var win = parent;
                        while (noteText == ""  &&  win) {
                            if (win.HEURIST  &&  win.HEURIST.edit.record  &&  win.HEURIST.edit.record.quickNotes)
                                noteText = win.HEURIST.edit.record.quickNotes;
                            if (win === top) break;
                            win = win.parent;
                        }

                        //top.HEURIST
                        if (parseInt(top.HEURIST.util.getDisplayPreference("scratchpad-width")))
                            width = parseInt(top.HEURIST.util.getDisplayPreference("scratchpad-width"));
                        if (parseInt(top.HEURIST.util.getDisplayPreference("scratchpad-height")))
                            height = parseInt(top.HEURIST.util.getDisplayPreference("scratchpad-height"));
                        if (parseInt(top.HEURIST.util.getDisplayPreference("scratchpad-bottom")))
                            bottom = parseInt(parent.HEURIST.util.getDisplayPreference("scratchpad-bottom")) || bottom;
                        if (parseInt(top.HEURIST.util.getDisplayPreference("scratchpad-right")))
                            right = parseInt(top.HEURIST.util.getDisplayPreference("scratchpad-right")) || right;

                        if (! top.HEURIST.util.parentWindow(window)) {
                            var notes = top.HEURIST.edit.createDraggableTextarea("notes", noteText, parent.document.getElementById("notes-container"),
                                { description: "<b>Scratchpad</b> &nbsp;&nbsp; Highlight text, drag and drop to fields",
                                    minimisedDescription: "<b>Scratchpad</b>",
                                    style: { bottom: bottom+"px", right: right+"px", width: width+"px", height: height+"px", minWidth: "300px" },
                                    scratchpad: true
                            });
                            notes.onchange = function() {
                                document.getElementById("notes").value = notes.value;
                                window.changed();
                            };
                        }
                    } else {
                        notes = top.document.getElementById("notes");
                    }

                    var bibIDfield = document.createElement("input");
                    bibIDfield.name = "recID";
                    bibIDfield.type = "hidden";
                    bibIDfield.value = record.bibID;
                    document.forms[0].appendChild(bibIDfield);

                    document.getElementById("save-mode").value = "edit";

                    window.HEURIST.inputs = inputs;

                }else if (rectype) {

                    //top.HEURIST
                    var defaultInputValues = {};
                    if (window.HEURIST.parameters["title"]) {
                        if (top.HEURIST.magicNumbers &&
                            top.HEURIST.magicNumbers['DT_JOURNAL_REFERENCE'] &&
                            top.HEURIST.magicNumbers['RT_JOURNAL_VOLUME'] &&
                            rectype == top.HEURIST.magicNumbers['RT_JOURNAL_VOLUME']) {
                            // journal volume - put the title into the journal pointer field, not the journal volume title field
                            defaultInputValues[top.HEURIST.magicNumbers['DT_JOURNAL_REFERENCE']] = [ { "title" : window.HEURIST.parameters["title"] } ];
                        } else {
                            defaultInputValues[top.HEURIST.magicNumbers['DT_NAME']] = [ { "value" : window.HEURIST.parameters["title"] } ];
                        }
                    }
                    
                    
                    //set ownership and visibility from given parameters - usualy it is from parent record
                    if (window.HEURIST.parameters["ownership"] && window.HEURIST.parameters["visibility"]) {
                        setWorkgroupProperties( window.HEURIST.parameters["ownership"], window.HEURIST.parameters["visibility"] );
                    }

                    if (window.HEURIST.parameters["addr"]) {
                        if (top.HEURIST.magicNumbers &&
                            top.HEURIST.magicNumbers['RT_ANNOTATION'] &&
                            top.HEURIST.magicNumbers['DT_START_ELEMENT'] &&
                            top.HEURIST.magicNumbers['DT_END_ELEMENT'] &&
                            top.HEURIST.magicNumbers['DT_START_WORD'] &&
                            top.HEURIST.magicNumbers['DT_END_WORD'] &&
                            rectype == top.HEURIST.magicNumbers['RT_ANNOTATION']) {
                            var addr = window.HEURIST.parameters["addr"];
                            if (top.HEURIST.magicNumbers['DT_ANNOTATION_RANGE'] && addr) {
                                defaultInputValues[top.HEURIST.magicNumbers['DT_ANNOTATION_RANGE']] = [ { "value" : "stwo:"+addr } ]; // structure text word offset encode
                            }
                            addr = addr.split(":");
                            if (addr.length == 4) {
                                defaultInputValues[top.HEURIST.magicNumbers['DT_START_ELEMENT']] = [ { "value" : addr[0] } ];
                                defaultInputValues[top.HEURIST.magicNumbers['DT_START_WORD']] = [ { "value" : addr[1] } ];
                                defaultInputValues[top.HEURIST.magicNumbers['DT_END_ELEMENT']] = [ { "value" : addr[2] } ];
                                defaultInputValues[top.HEURIST.magicNumbers['DT_END_WORD']] = [ { "value" : addr[3] } ];
                            }
                            var trgRecID = window.HEURIST.parameters["trgRecID"];
                            var trgRecTitle = window.HEURIST.parameters["trgRecTitle"];
                            if (trgRecID && trgRecTitle) {
                                if (top.HEURIST.magicNumbers['DT_ANNOTATION_RESOURCE']){
                                    defaultInputValues[top.HEURIST.magicNumbers['DT_ANNOTATION_RESOURCE']] = [ { "value" : trgRecID,  "title" :trgRecTitle } ]
                                }else{
                                    defaultInputValues[top.HEURIST.magicNumbers['DT_TEI_DOCUMENT_REFERENCE']] = [ { "value" : trgRecID, "title" : trgRecTitle } ];
                                }
                            }
                            var annoType = window.HEURIST.parameters["type"];
                            if (annoType && top.HEURIST.magicNumbers['DT_TOOL_TYPE']) {
                                defaultInputValues[top.HEURIST.magicNumbers['DT_TOOL_TYPE']] = [ { "value" : annoType } ];
                            }
                            var annoText = window.HEURIST.parameters["text"];
                            if (annoText && top.HEURIST.magicNumbers['DT_SHORT_SUMMARY']) {
                                defaultInputValues[top.HEURIST.magicNumbers['DT_SHORT_SUMMARY']] = [ { "value" : annoText } ];
                            }
                        } else if (top.HEURIST.magicNumbers &&// image annontation
                            top.HEURIST.magicNumbers['DT_ANNOTATION_RANGE'] &&
                            top.HEURIST.magicNumbers['DT_ANNOTATION_RESOURCE'])
                            //&& (rectype == 36)) //todo - change to verification of existance of "image annotation area" field type  top.HEURIST.magicNumbers['RT_ANNOTATION_IMAGE']) &&
                            {
                                var addr = window.HEURIST.parameters["addr"];
                                defaultInputValues[top.HEURIST.magicNumbers['DT_ANNOTATION_RANGE']] = [ { "value" : "i:"+addr } ];   //top.HEURIST.magicNumbers['DT_END_WORD']

                                var trgRecID = window.HEURIST.parameters["trgRecID"];
                                var trgRecTitle = window.HEURIST.parameters["trgRecTitle"];
                                if (trgRecID && trgRecTitle) {
                                    defaultInputValues[top.HEURIST.magicNumbers['DT_ANNOTATION_RESOURCE']] = [ { "value" : trgRecID,  "title" :trgRecTitle } ]
                                }
                            }

                    }
                    //top.HEURIST
                    var inputs = top.HEURIST.edit.createInputsForRectype(null,rectype, defaultInputValues, allInputs);

                    renderExtraDataHeader(allInputs);

                    if (userCanEdit) {
                        renderAdditionalDataSection(allInputs, null, rectype);
                    }

                    top.HEURIST.edit.setAllInputsReadOnly(!userCanEdit);

                    if (! top.document.getElementById("notes")) {
                        var width = 400;
                        var height = 160;
                        var bottom = 32;
                        var right = 32;

                        // Find some notes to drop in the scratchpad ... traipse up the window hierarchy
                        var noteText = "";
                        var win = parent;
                        while (noteText == ""  &&  win) {
                            if (win.HEURIST  &&  win.HEURIST.edit.record  &&  win.HEURIST.edit.record.quickNotes)
                                noteText = win.HEURIST.edit.record.quickNotes;
                            if (win == top) break;
                            win = win.parent;
                        }

                        if (parseInt(top.HEURIST.util.getDisplayPreference("scratchpad-width")))
                            width = parseInt(top.HEURIST.util.getDisplayPreference("scratchpad-width"));
                        if (parseInt(top.HEURIST.util.getDisplayPreference("scratchpad-height")))
                            height = parseInt(top.HEURIST.util.getDisplayPreference("scratchpad-height"));
                        if (parseInt(top.HEURIST.util.getDisplayPreference("scratchpad-bottom")))
                            bottom = parseInt(top.HEURIST.util.getDisplayPreference("scratchpad-bottom")) || bottom;
                        if (parseInt(top.HEURIST.util.getDisplayPreference("scratchpad-right")))
                            right = parseInt(top.HEURIST.util.getDisplayPreference("scratchpad-right")) || right;

                        if (! top.HEURIST.util.parentWindow(window)) {
                            var ele = top.document.getElementById("notes-container");
                            if(ele){
                            var notes = top.HEURIST.edit.createDraggableTextarea("notes", noteText, ele,
                                { description: "<b>Scratchpad</b> &nbsp;&nbsp; Highlight text, drag and drop to fields",
                                    minimisedDescription: "<b>Scratchpad</b>",
                                    style: { bottom: bottom+"px", right: right+"px", width: width+"px", height: height+"px", minWidth: "300px" },
                                    scratchpad: true });

                            notes.onchange = function() { console.log(document.getElementById("notes").value = notes.value); window.changed(); };
                            }
                        }
                    }

                    document.getElementById("save-mode").value = "new";

                    window.HEURIST.inputs = inputs;
                }


                var rftElement = document.getElementById("rectype");
                if (! rftElement) {
                    rftElement = document.createElement("input");
                    rftElement.type = "hidden";
                    rftElement.name = "rectype";
                    rftElement.id = "rectype";
                    document.forms[0].appendChild(rftElement);
                }
                rftElement.value = rectype || (record ? record.rectypeID:top.HEURIST.magicNumbers['RT_INTERNET_BOOKMARK']);
            }

            function renderAdditionalDataSection(container, recID, rectypeID, bdValues) {
                var dtyFieldNamesToDtIndexMap = top.HEURIST.detailTypes.typedefs.fieldNamesToIndex;

                var addRow = container.appendChild(document.createElement("div"));
                addRow.className = "input-row extradata";
                var addHeaderCell = addRow.appendChild(document.createElement("div"));
                addHeaderCell.className = "input-header-cell";
                
                /* Removed 13/4/16: While this was useful during early development, it has long since been superfluous/undesirable
                var moreLink = addHeaderCell.appendChild(document.createElement("a"));
                moreLink.innerHTML = "more...";
                */
                
                var addCell = addRow.appendChild(document.createElement("div"));
                addCell.className = "input-cell";
                addCell.style.display = "none";

                /* Removed 13/4/16: see comment above
                moreLink.onclick = function() {
                    //            moreLink.parentNode.removeChild(moreLink);
                    addHeaderCell.innerHTML = "Add field:";
                    addCell.style.display = "table-cell";
                }
                */
                
                var dts = top.HEURIST.edit.getNonRecDetailTypedefs(rectypeID);
                if (bdValues) {
                    for (var dtID in bdValues) {
                        delete dts[dtID];
                    }
                }

                var dtsByName = {};
                for (var dtID in dts) {
                    if (dtID == 'commonFieldNames') continue;
                    dtsByName[dts[dtID]['commonFields'][dtyFieldNamesToDtIndexMap['dty_Name']]]= dts[dtID]['commonFields'];
                }
                var dtNames = [];
                for (var name in dtsByName) {
                    dtNames.push(name);
                }
                dtNames = dtNames.sort();

                var dtSelect = addCell.appendChild(document.createElement("select"));
                dtSelect.options[0] = new Option("Select field type...", "");
                dtSelect.options[0].disabled = true;
                var i = 1;
                for (var n = 0; n < dtNames.length; ++n) {
                    var name = dtNames[n];
                    dtSelect.options[i++] = new Option(dtsByName[name][dtyFieldNamesToDtIndexMap['dty_Name']], dtsByName[name][dtyFieldNamesToDtIndexMap['dty_ID']]);
                }
                var button = document.createElement("input");
                button.type = "button";
                button.value = "add";
                button.onclick = function() {
                    if (dtSelect.selectedIndex == 0) return;
                    window.HEURIST.inputs.push(top.HEURIST.edit.createInput(recID, dtSelect.value, 0, [], container));
                    dtSelect.remove(dtSelect.selectedIndex);
                    dtSelect.selectedIndex = 0;
                };
                addCell.appendChild(button);
                var promptDiv = addCell.appendChild(document.createElement("div"));
                promptDiv.className = "help prompt";
                promptDiv.innerHTML = "Advanced users only; additional fields may not be rendered by standard reporting formats";
            }


            function renderExtraDataHeader(container) {

                var sepRow = container.appendChild(document.createElement("div"));
                sepRow.className = "separator_row";
                sepRow.style.margin = "20px 0 0 0";

                var extraDataHeader = container.appendChild(document.createElement("div"));
                extraDataHeader.className = "title-row extradata hidden";
                var hrCell = extraDataHeader.appendChild(document.createElement("div"));
                hrCell.innerHTML = "<b>Non-standard fields for this record type</b>";
                hrCell.className = "additional-header-cell";

                return extraDataHeader;
            }


