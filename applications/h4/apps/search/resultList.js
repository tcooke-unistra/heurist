/**
* Query result listing. 
* 
* NO Requires apps/rec_actions.js (must be preloaded)
* Requires apps/search/resultListMenu.js (must be preloaded)
* 
* @package     Heurist academic knowledge management system
* @link        http://HeuristNetwork.org
* @copyright   (C) 2005-2014 University of Sydney
* @author      Artem Osmakov   <artem.osmakov@sydney.edu.au>
* @license     http://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
* @version     4.0
*/

/*
* Licensed under the GNU License, Version 3.0 (the "License"); you may not use this file except in compliance
* with the License. You may obtain a copy of the License at http://www.gnu.org/licenses/gpl-3.0.txt
* Unless required by applicable law or agreed to in writing, software distributed under the License is
* distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied
* See the License for the specific language governing permissions and limitations under the License.
*/


$.widget( "heurist.resultList", {

    // default options
    options: {
        view_mode: 'list', // list|icons|thumbnails   @toimplement detail, condenced
        multiselect: true,
        isapplication: true,
        showcounter: true,
        showmenu: true,
        //searchsource: null,
        
        recordset: null   //united recordset
        // callbacks
        //onselect: null
    },
    

    _query_request: null, //keep current query request
    _total_count_of_curr_request: 0, //total count for current request (main and rules)
    
    _events: null,
    _lastSelectedIndex: -1,

    //_results:{},   // storage for record IDS - results of each rule request
    _rule_index: -1, // current index 
    _res_index:  -1, // current index in result array (chunked by 1000)
    _rules:[],       // flat array of rules for current query request
    
    /* format
    
         rules:{   {parent: index,  // index to top level
                    level: level,   
                    query: },    
            
         results: { root:[], ruleindex:[  ],  ruleindex:[  ] }    
    
    
         requestXXX - index in rules array?  OR query string?
    
            ids:[[1...1000],[1001....2000],....],     - level0
            request1:{ ids:[],                          level1
                    request2:{},                        level2
                    request2:{ids:[], 
                            request3:{} } },            level3
                            
                            
                            
                            
                            
    
    */
    

    // the constructor
    _create: function() {

        var that = this;

        //this.div_actions = $('<div>').css({'width':'100%', 'height':'2.8em'}).appendTo(this.element);
        

        this.div_toolbar = $( "<div>" ).css({'width': '100%', 'height':'3.8em'}).appendTo( this.element );
        this.div_content = $( "<div>" )
        .css({'left':0,'right':'15px','overflow-y':'auto','padding':'0.5em','position':'absolute','top':'4em','bottom':'15px'})   //@todo - proper relative layout
        //.position({my: "left top", at: "left bottom", of: this.div_toolbar })
        .appendTo( this.element );

        /*
        this.action_buttons = $('<div>')
        .css('display','inline-block')
        .rec_actions({actionbuttons: this.options.actionbuttons})
        .appendTo(this.div_toolbar);
        */

        //-----------------------
        this.span_info = $("<label>").appendTo(
            $( "<div>").css({'display':'inline-block','min-width':'10em','padding':'3px 2em 0 300px'}).appendTo( this.div_toolbar ));

        //-----------------------
        this.btn_view = $( "<button>", {text: "view"} )
        .css({'float':'right', 'font-size': '0.8em', 'width': '10em'})
        .appendTo( this.div_toolbar )
        .button({icons: {
            secondary: "ui-icon-triangle-1-s"
            },text:true});

        this.menu_view = $('<ul>'+
            '<li id="menu-view-list"><a href="#">'+top.HR('list')+'</a></li>'+
            //'<li id="menu-view-detail"><a href="#">Details</a></li>'+
            '<li id="menu-view-icons"><a href="#">'+top.HR('icons')+'</a></li>'+
            '<li id="menu-view-thumbs"><a href="#">'+top.HR('thumbs')+'</a></li>'+
            '</ul>')
        .addClass('menu-or-popup')
        .css('position','absolute')
        .appendTo( this.document.find('body') )
        .menu({
            select: function( event, ui ) {
                var mode = ui.item.attr('id');
                mode = mode.substr(10);
                that._applyViewMode(mode);
        }})
        .hide();

        var view_mode = top.HAPI4.get_prefs('rec_list_viewmode');        
        if(view_mode){
            this._applyViewMode(view_mode);
        }

        this._on( this.btn_view, {
            click: function(e) {
                $('.menu-or-popup').hide(); //hide other
                var menu_view = $( this.menu_view )
                .show()
                .position({my: "right top", at: "right bottom", of: this.btn_view });
                $( document ).one( "click", function() {  menu_view.hide(); });
                return false;
            }
        });
        
        //-----------------------
                                                            //,'height':'1em'               
        this.div_progress = $( "<div>" ).css({'position':'absolute','left':2,'right':2,'top':'2em'}).appendTo( this.div_toolbar );
                                                                                               
        this.lbl_current_request = $("<div>").css({'display':'inline-block','width':'100px','text-align':'center'}).appendTo(this.div_progress);
        this.span_progress = $("<div>")
            .css({'position':'absolute','right':'100px','left':'100px', 'margin-top':'5px', 'display':'inline-block', 'height':'9px', 'margin':'0px !important'})
            .progressbar().appendTo(this.div_progress);

        this.btn_stop_search = $( "<button>", {text: "stop"} )
              .css({'font-size': '0.8em','position':'absolute','right':'15px'})
              .appendTo( this.div_progress )
              .button({icons: {
                  secondary: "ui-icon-cancel"
                 },text:true});

        this._on( this.btn_stop_search, {
            click: function(e) {
                if(this._query_request!=null){ //assign new id to search - it prevents further increment search
                    this._query_request.id = Math.round(new Date().getTime() + (Math.random() * 100));                  
                    this.div_progress.hide();
                    //this._renderProgress();
                }
            }
        });
        
        //.css({'display':'inline-block'}).appendTo(this.div_progress);

        //----------------------
        
        if(this.options.showmenu){
            this.div_actions = $('<div>')
                .css({'position':'absolute','top':3,'left':2})
                .resultListMenu()
                .appendTo(this.div_toolbar);
        }
        
        
        //-----------------------     listener of global events
        this._events = top.HAPI4.Event.LOGIN+' '+top.HAPI4.Event.LOGOUT;
        if(this.options.isapplication){
            this._events = this._events + ' ' + top.HAPI4.Event.ON_REC_SEARCHRESULT + ' ' 
                        + top.HAPI4.Event.ON_REC_SEARCHSTART + ' ' + top.HAPI4.Event.ON_REC_SEARCH_APPLYRULES 
                        + ' ' + top.HAPI4.Event.ON_REC_SELECT;
        }

        $(this.document).on(this._events, function(e, data) {

            if(e.type == top.HAPI4.Event.LOGIN){

                that._refresh();

            }else  if(e.type == top.HAPI4.Event.LOGOUT)
            {
                that.option('recordset', null);

            }else if(e.type == top.HAPI4.Event.ON_REC_SEARCHRESULT){ //get new chunk of data from server

                //that.option('recordset', data); //hRecordSet
                that.loadanimation(false);
                
                if(that._query_request!=null &&  data.queryid()==that._query_request.id) {  
                
                    that._renderRecordsIncrementally(data); //hRecordSet
                    that._doSearchIncrement(); //load next chunk
                }

                
            }else if(e.type == top.HAPI4.Event.ON_REC_SEARCH_APPLYRULES){
                
                if(data){
                    //create flat rule array
                    that._doApplyRules(data); //indexes are rest inside this function
                  
                    //if rules were applied before - need to remove all records except original and re-render
                    if(!top.HEURIST.util.isempty(that._rules) && that._rules[0].results.length>0){
                         
                         //keep json (to possitble save as saved searches)
                         that._query_request.rules = data;
                        
                         // re-render the original set of records only                        
                         var rec_ids_level0 = [];
                         
                         var idx;
                         var keep_it = that._rules[0].results;
                         for(idx=0; idx<that._rules[0].results.length; idx++){
                            rec_ids_level0 = rec_ids_level0.concat(that._rules[0].results[idx]);
                         }
                         
                         var data = that.options.recordset.getSubSetByIds(rec_ids_level0);
                         that.options.recordset = null;
                         that._clearAllRecordDivs();
                         //that.option('recordset', null);
                         that._rules[0].results = [];
                         that._renderRecordsIncrementally(data); //hRecordSet
                         //keep results separated by chunks
                         that._rules[0].results = keep_it;
                    
                         that._doSearchIncrement(); //start search dependent records according to rules        
                    }
                }
                
            }else if(e.type == top.HAPI4.Event.ON_REC_SEARCHSTART){

                if(data){
                    
                    if(that._query_request==null || data.source!=that.element.attr('id') || data.id!=that._query_request.id) {  
                        //new search from outside
                        //reset recordset 
                    
                        var new_title = top.HR(data.qname || 'Search result');
                        var $header = $(".header"+that.element.attr('id'));
                        $header.html(new_title);
                        $('a[href="#'+that.element.attr('id')+'"]').html(new_title);

                        that.option('recordset', null);
                        
                        that.loadanimation(true);
                        
                        if( data.rules!=null ){
                            //create flat rule array
                            that._doApplyRules(data.rules);
                        }
                        
                        that._renderProgress();
                        
                    }
                    that._query_request = data;  //keep current query request 
                }
                
            }else if(e.type == top.HAPI4.Event.ON_REC_SELECT){
                
                //this selection is triggered by some other app - we have to redraw selection
                if(data && data.source!=that.element.attr('id')) { 
                      that.setSelected(data.selection);
                }
            }
            //that._refresh();
        });
        /*
        if(this.options.isapplication){
        $(this.document).on(top.HAPI4.Event.ON_REC_SEARCHRESULT, function(e, data) {
        that.option("recordset", data); //hRecordSet
        that._refresh();
        });
        }
        */

        

        
        
        this._refresh();

    }, //end _create

    _setOptions: function() {
        // _super and _superApply handle keeping the right this-context
        this._superApply( arguments );
        this._refresh();
    },
    
    _setOption: function( key, value ) {
        this._super( key, value );
        
        if(key=='recordset' && value==null){
            //reset counters and storages
            this._rule_index = -1; // current index 
            this._res_index =  -1; // current index in result array (chunked by 1000)
            this._rules = [];      // flat array of rules for current query request
            
            this._clearAllRecordDivs();
        }
        //this._refresh();
    },
    

    /* private function */
    _refresh: function(){

        // repaint current record set
        //??? this._renderRecords();  //@todo add check that recordset really changed  !!!!!
        this._applyViewMode();

        if(top.HAPI4.currentUser.ugr_ID>0){
            $(this.div_toolbar).find('.logged-in-only').css('visibility','visible');
            $(this.div_content).find('.logged-in-only').css('visibility','visible');
        }else{
            $(this.div_toolbar).find('.logged-in-only').css('visibility','hidden');
            $(this.div_content).find('.logged-in-only').css('visibility','hidden');
        }

        /*
        var abtns = (this.options.actionbuttons?this.options.actionbuttons:"tags,share,more,sort,view").split(',');
        var that = this;
        $.each(this._allbuttons, function(index, value){

            var btn = that['btn_'+value];
            if(btn){
                btn.css('display',($.inArray(value, abtns)<0?'none':'inline-block'));
            }
        });
        */


    },

    // events bound via _on are removed automatically
    // revert other modifications here
    _destroy: function() {

        $(this.document).off(this._events);

        var that = this;
        /*$.each(this._allbuttons, function(index, value){
            var btn = that['btn_'+value];
            if(btn) btn.remove();
        });*/

        // remove generated elements
        if(this.div_actions) this.div_actions.remove();
        this.div_toolbar.remove();
        this.div_content.remove();


        this.menu_tags.remove();
        this.menu_share.remove();
        this.menu_more.remove();
        this.menu_view.remove();

    },


    _initTagMenu: function() {

        this.menu_tags = $('<div>')
        .addClass('menu-or-popup')
        .css('position','absolute')
        .appendTo( this.document.find('body') )
        .tag_manager()
        .hide();

        this.btn_tags.click();
    },

    _applyViewMode: function(newmode){

        //var $allrecs = this.div_content.find('.recordDiv');
        if(newmode){
            var oldmode = this.options.view_mode;
            this.options.view_mode = newmode;
            //this.option("view_mode", newmode);
            this.div_content.removeClass(oldmode);

            //save viewmode is session
            top.HAPI4.SystemMgr.save_prefs({'rec_list_viewmode': newmode});

        }else{
            newmode = this.options.view_mode;
        }
        this.div_content.addClass(newmode);

        this.btn_view.button( "option", "label", top.HR(newmode));
    },

    // @todo move record related stuff to HAPI
    // NOT USED 
    _renderRecords: function(){

        if(this.div_content){
            var $allrecs = this.div_content.find('.recordDiv');
            this._off( $allrecs, "click");
            this.div_content[0].innerHTML = '';//.empty();  //clear
        }

        if(this.options.recordset){
            this.loadanimation(false);

            var recs = this.options.recordset.getRecords();

            if( this.options.recordset.count_total() > 0 )
            {
                //for(i=0; i<recs.length; i++){
                //$.each(this.options.records.records, this._renderRecord)
                var recID;
                for(recID in recs) {
                    if(recID){
                        this._renderRecord(recs[recID]);
                    }
                }

                $allrecs = this.div_content.find('.recordDiv');
                this._on( $allrecs, {
                    click: this._recordDivOnClick
                });

            }else{

                var $emptyres = $('<div>')
                .html(top.HR('No records match the search')+
                    '<div class="prompt">'+top.HR((top.HAPI4.currentUser.ugr_ID>0)
                        ?'Note: some records are only visible to members of particular workgroups'
                        :'To see workgoup-owned and non-public records you may need to log in')+'</div>'
                )
                .appendTo(this.div_content);                   

                if(top.HAPI4.currentUser.ugr_ID>0 && this._query_request){ //logged in and current search was by bookmarks
                    var domain = this._query_request.w
                    if((domain=='b' || domain=='bookmark')){
                        var $al = $('<a href="#">')
                        .text(top.HR('Click here to search the whole database'))
                        .appendTo($emptyres);
                        this._on(  $al, {
                            click: this._doSearch4
                        });

                    }
                }
            }
        }

    },

    _clearAllRecordDivs: function(){

        //this.options.recordset = null;
        
        if(this.div_content){
            var $allrecs = this.div_content.find('.recordDiv');
            this._off( $allrecs, "click");
            this.div_content[0].innerHTML = '';//.empty();  //clear
        }
        
    },
    
    
    /**
    * Add new divs and join recordset
    * 
    * @param recordset
    */
    _renderRecordsIncrementally: function(recordset){

        if(recordset)
        {
            //this.loadanimation(false);
            if(this.options.recordset==null){
                this.options.recordset = recordset;
            }else{
                //unite record sets 
                this.options.recordset = this.options.recordset.doUnite(recordset);
            }   
            
            this._total_count_of_curr_request = (recordset!=null)?recordset.count_total():0;
            
            this._renderProgress();

            if( this._total_count_of_curr_request > 0 )
            {

                if(this.options.recordset.length()<10001){
                
                    var recs = recordset.getRecords();

                    var html = '';
                    var recID;
                    for(recID in recs) {
                        if(recID){
                            //var recdiv = this._renderRecord(recs[recID]);
                            html  += this._renderRecord_html(recs[recID]);
                            /*this._on( recdiv, {
                                click: this._recordDivOnClick
                            });*/
                        }
                    }
                    this.div_content[0].innerHTML += html;   

                    /*var lastdiv = this.div_content.last( ".recordDiv" ).last();
                    this._on( lastdiv.nextAll(), {
                                click: this._recordDivOnClick
                            });*/
                }
                $allrecs = this.div_content.find('.recordDiv');
                this._on( $allrecs, {
                    click: this._recordDivOnClick
                });
                
                //save increment into current rules.results
                var records_ids = recordset.getIds()
                if(records_ids.length>0){
                    // rules:[ {query:query, results:[], parent:index},  ]
                
                    var ruleindex = this._rule_index;
                    if(ruleindex<0){
                         ruleindex = 0; //root/main search
                    }
                    if(top.HEURIST4.util.isempty(this._rules)){
                         this._rules = [{results:[]}];
                    }
                    this._rules[ruleindex].results.push(records_ids);
                }

            }else if(this._rule_index<1) {

                var $emptyres = $('<div>')
                .html(top.HR('No records match the search')+
                    '<div class="prompt">'+top.HR((top.HAPI4.currentUser.ugr_ID>0)
                        ?'Note: some records are only visible to members of particular workgroups'
                        :'To see workgoup-owned and non-public records you may need to log in')+'</div>'
                )
                .appendTo(this.div_content);                   

                if(top.HAPI4.currentUser.ugr_ID>0 && this._query_request){ //logged in and current search was by bookmarks
                    var domain = this._query_request.w
                    if((domain=='b' || domain=='bookmark')){
                        var $al = $('<a href="#">')
                        .text(top.HR('Click here to search the whole database'))
                        .appendTo($emptyres);
                        this._on(  $al, {
                            click: this._doSearch4
                        });

                    }
                }
            }
        }

    },
    
    
    /**
    * create div for given record
    *
    * @param record
    */
    _renderRecord: function(record){

        var recset = this.options.recordset;
        function fld(fldname){
            return recset.fld(record, fldname);
        }

        /*
        0 .'bkm_ID,'
        1 .'bkm_UGrpID,'
        2 .'rec_ID,'
        3 .'rec_URL,'
        4 .'rec_RecTypeID,'
        5 .'rec_Title,'
        6 .'rec_OwnerUGrpID,'
        7 .'rec_NonOwnerVisibility,'
        8. rec_ThumbnailURL

        9 .'rec_URLLastVerified,'
        10 .'rec_URLErrorMessage,'
        11 .'bkm_PwdReminder ';
        11  thumbnailURL - may not exist
        */

        var recID = fld('rec_ID');
        var rectypeID = fld('rec_RecTypeID');

        $recdiv = $(document.createElement('div'));

        $recdiv
        .addClass('recordDiv')
        .attr('id', 'rd'+recID )
        .attr('recID', recID )
        .attr('bkmk_id', fld('bkm_ID') )
        .attr('rectype', rectypeID )
        //.attr('title', 'Select to view, Ctrl-or Shift- for multiple select')
        //.on("click", that._recordDivOnClick )
        .appendTo(this.div_content);

        $(document.createElement('div'))
        .addClass('recTypeThumb')
        .css('background-image', 'url('+ top.HAPI4.iconBaseURL + 'thumb/th_' + rectypeID + '.png)')
        .appendTo($recdiv);

        if(fld('rec_ThumbnailURL')){
            $(document.createElement('div'))
            .addClass('recTypeThumb')
            .css({'background-image': 'url('+ fld('rec_ThumbnailURL') + ')', 'opacity':'1' } )
            .appendTo($recdiv);
        }

        $iconsdiv = $(document.createElement('div'))
        .addClass('recordIcons')
        .attr('recID', recID )
        .attr('bkmk_id', fld('bkm_ID') )
        .appendTo($recdiv);

        //record type icon
        $('<img>',{
            src:  top.HAPI4.basePath+'assets/16x16.gif',
            title: '@todo rectypeTitle'.htmlEscape()
        })
        //!!! .addClass('rtf')
        .css('background-image', 'url('+ top.HAPI4.iconBaseURL + rectypeID + '.png)')
        .appendTo($iconsdiv);

        //bookmark icon - asterics
        $('<img>',{
            src:  top.HAPI4.basePath+'assets/13x13.gif'
        })
        .addClass(fld('bkm_ID')?'bookmarked':'unbookmarked')
        .appendTo($iconsdiv);

        $('<div>',{
            title: fld('rec_Title')
        })
        .addClass('recordTitle')
        .html(fld('rec_URL') ?("<a href='"+fld('rec_URL')+"' target='_blank'>"+fld('rec_Title') + "</a>") :fld('rec_Title') )
        .appendTo($recdiv);

        $('<div>',{
            id: 'rec_edit_link',
            title: 'Click to edit record'
        })
        .addClass('logged-in-only')
        .button({icons: {
            primary: "ui-icon-pencil"
            },
            text:false})
        .click(function( event ) {
            event.preventDefault();
            window.open(top.HAPI4.basePath + "php/recedit.php?db="+top.HAPI4.database+"&q=ids:"+recID, "_blank");
        })
        .appendTo($recdiv);


        /*
        var editLinkIcon = "<div id='rec_edit_link' class='logged-in-only'><a href='"+
        top.HEURIST4.basePath+ "records/edit/editRecord.html?sid=" +
        top.HEURIST4.search.results.querySid + "&recID="+ res[2] +
        (top.HEURIST4.database && top.HEURIST4.database.name ? '&db=' + top.HEURIST4.database.name : '');

        if (top.HEURIST4.user && res[6] && (top.HEURIST4.user.isInWorkgroup(res[6])|| res[6] == top.HEURIST4.get_user_id()) || res[6] == 0) {
        editLinkIcon += "' target='_blank' title='Click to edit record'><img src='"+
        top.HEURIST4.basePath + "common/images/edit-pencil.png'/></a></div>";
        }else{
        editLinkIcon += "' target='_blank' title='Click to edit record extras only'><img src='"+
        top.HEURIST4.basePath + "common/images/edit-pencil-no.png'/></a></div>";
        }
        */

        
        return $recdiv;
    },
    
    _renderRecord_html: function(record){

        var recset = this.options.recordset;
        function fld(fldname){
            return recset.fld(record, fldname);
        }

        /*
        0 .'bkm_ID,'
        1 .'bkm_UGrpID,'
        2 .'rec_ID,'
        3 .'rec_URL,'
        4 .'rec_RecTypeID,'
        5 .'rec_Title,'
        6 .'rec_OwnerUGrpID,'
        7 .'rec_NonOwnerVisibility,'
        8. rec_ThumbnailURL

        9 .'rec_URLLastVerified,'
        10 .'rec_URLErrorMessage,'
        11 .'bkm_PwdReminder ';
        11  thumbnailURL - may not exist
        */

        var recID = fld('rec_ID');
        var rectypeID = fld('rec_RecTypeID');
        var bkm_ID = fld('bkm_ID');
        var recTitle = fld('rec_Title');//.htmlescape();
        
        var html_thumb = '';
        if(fld('rec_ThumbnailURL')){
            html_thumb = '<div class="recTypeThumb" style="background-image: url(&quot;'+ fld('rec_ThumbnailURL') + '&quot;);opacity:1"></div>'
        }
    
        var html = '<div class="recordDiv" id="rd'+recID+'" recid="'+recID+'" rectype="'+rectypeID+'" bkmk_id="'+bkm_ID+'">'
            + '<div class="recTypeThumb" style="background-image: url(&quot;'+ top.HAPI4.iconBaseURL + 'thumb/th_' + rectypeID + '.png&quot;);"></div>'
            + html_thumb 
            + '<div class="recordIcons" recid="'+recID+'" bkmk_id="'+bkm_ID+'">'
            +     '<img src="'+top.HAPI4.basePath+'assets/16x16.gif'+'" title="@todo rectypeTitle" style="background-image: url(&quot;'+top.HAPI4.iconBaseURL + rectypeID+'.png&quot;);">'
            +     '<img src="'+top.HAPI4.basePath+'assets/13x13.gif" class="'+(bkm_ID?'bookmarked':'unbookmarked')+'">'
            + '</div>'
            + '<div title="'+recTitle+'" class="recordTitle">'
            +     (fld('rec_URL') ?("<a href='"+fld('rec_URL')+"' target='_blank'>"+ recTitle + "</a>") :recTitle)  
            + '</div>'
            + '<div id="rec_edit_link" title="Click to edit record" class="logged-in-only ui-button ui-widget ui-state-default ui-corner-all ui-button-icon-only" role="button" aria-disabled="false">'
            +     '<span class="ui-button-icon-primary ui-icon ui-icon-pencil"></span><span class="ui-button-text"></span>'
            + '</div></div>';

            
        return html;

        /*$('<div>',{
            id: 'rec_edit_link',
            title: 'Click to edit record'
        })
        .addClass('logged-in-only')
        .button({icons: {
            primary: "ui-icon-pencil"
            },
            text:false})
        .click(function( event ) {
            event.preventDefault();
            window.open(top.HAPI4.basePath + "php/recedit.php?db="+top.HAPI4.database+"&q=ids:"+recID, "_blank");
        })
        .appendTo($recdiv);*/
        
        
    },
   
    _recordDivOnClick: function(event){

        //var $allrecs = this.div_content.find('.recordDiv');

        var $rdiv = $(event.target);

        if(!$rdiv.hasClass('recordDiv')){
            $rdiv = $rdiv.parents('.recordDiv');
        }

        var selected_rec_ID = $rdiv.attr('recid');

        if(this.options.multiselect && event.ctrlKey){

            if($rdiv.hasClass('selected')){
                $rdiv.removeClass('selected');
                //$rdiv.removeClass('ui-state-highlight');
            }else{
                $rdiv.addClass('selected');
                //$rdiv.addClass('ui-state-highlight');
            }
            lastSelectedIndex = selected_rec_ID;
            
        }else if(this.options.multiselect && event.shiftKey){
            
            if(Number(lastSelectedIndex)>0){
                var nowSelectedIndex = selected_rec_ID;
                
                this.div_content.find('.selected').removeClass('selected');
                
                var isstarted = false;
                
                this.div_content.find('.recordDiv').each(function(ids, rdiv){
                        var rec_id = $(rdiv).attr('recid');
                        
                        if(rec_id == lastSelectedIndex || rec_id==nowSelectedIndex){
                              if(isstarted){
                                  $(rdiv).addClass('selected');
                                  return false;
                              }
                              isstarted = true;
                        }
                        if(isstarted) {
                            $(rdiv).addClass('selected');
                        }
                });
                
                
                
            }else{
                lastSelectedIndex = selected_rec_ID;    
            }
            
            
        }else{
            //remove seletion from all recordDiv
            this.div_content.find('.selected').removeClass('selected');
            $rdiv.addClass('selected');
            lastSelectedIndex = selected_rec_ID;

            //var record = this.options.recordset.getById($rdiv.attr('recID'));
        }

        this.triggerSelection();
    },
    
    triggerSelection: function(){
        
        var selected = this.getSelected();

        if(this.options.isapplication){
            $(this.document).trigger(top.HAPI4.Event.ON_REC_SELECT, {selection:selected, source:this.element.attr('id')} );
        }
        
        //this._trigger( "onselect", event, selected );
    },

    /**
    * return hRecordSet of selected records
    */
    getSelected: function(){

        var selected = {};
        var that = this;
        this.div_content.find('.selected').each(function(ids, rdiv){
            var rec_ID = $(rdiv).attr('recid');
            var record = that.options.recordset.getById(rec_ID);
            selected[rec_ID] = record;
        });

        return that.options.recordset.getSubSet(selected);
    },

    /**
    * selection - hRecordSet
    * 
    * @param record_ids
    */
    setSelected: function(selection){

        //clear selection
        this.div_content.find('.selected').removeClass('selected');
        
        if( selection && (typeof selection == "function") && selection.isA("hRecordSet") ){
            if(selection.length()>0){
                var recIDs_list = _selection.getIds(); //array of record ids   

                this.div_content.find('.recordDiv').each(function(ids, rdiv){
                        var rec_id = $(rdiv).attr('recid');
                        if(recIDs_list.indexOf(rec_id)>=0){
                           $(rdiv).addClass('selected'); 
                        }
                });
            }
        }else if (selection == "all") {
            this.div_content.find('.recordDiv').addClass('selected');   
        }        
        
        this.triggerSelection();
    },
    
    
    loadanimation: function(show){
        if(show){
            this.div_content.css('background','url('+top.HAPI4.basePath+'assets/loading-animation-white.gif) no-repeat center center');
        }else{
            this.div_content.css('background','none');
        }
    },

    /**
    * search with the same criteria for all reocrds (assumed before it was for bookmarks)
    * 
    * @returns {Boolean}
    */
    _doSearch4: function(){

        if ( this._query_request ) {

            this._query_request.w = 'a';
            this._query_request.source = this.element.attr('id'); //orig = 'rec_list';

            top.HAPI4.RecordMgr.search(this._query_request, $(this.document));
        }

        return false;
    }, 

    
    /**
    * Rules may be applied at once (part of query request) or at any time later
    *  
    * 1. At first we have to create flat rule array   
    */
    _doApplyRules: function(rules_tree){
        
         // original rule array
         // rules:[ {query:query, levels:[]}, ....  ]           
         
         // we create flat array to allow smooth loop
         // rules:[ {query:query, results:[], parent:index},  ]
        
        var flat_rules = [ { results:[] } ];
        
        function __createFlatRulesArray(r_tree, parent_index){
            var i;
            for (i=0;i<r_tree.length;i++){
                var rule = { query: r_tree[i].query, results:[], parent:parent_index }
                flat_rules.push(rule);
                __createFlatRulesArray(r_tree[i].levels, flat_rules.length-1);
            }
        }
        
        //it may be json
        if(!top.HEURIST.util.isempty(rules_tree) && !$.isArray(rules_tree)){
             rules_tree = $.parseJSON(rules_tree);
        }
        
        __createFlatRulesArray(rules_tree, 0);

        //assign zero level - top most query
        if(this.options.recordset!=null){  //aplying rules to existing set 
            
            //result for zero level retains
            flat_rules[0].results = this._rules[0].results;
            
            this._rule_index = 0; // current index 
        }else{
            this._rule_index = -1;
        }
        this._res_index = 0; // current index in result array (chunked by 1000)
        
        this._rules = flat_rules;
        
    },
    
    
    _renderProgress: function(){

        // show current records range and total count
        if(this.options.showcounter && this.options.recordset && this.options.recordset.length()>0){
            
            var s = '';
            
            var isTerminated = false; //(this._query_request==null || this.options.recordset.queryid()!=this._query_request.id);

            if(this._rule_index>0 && !isTerminated){ //this search by rules
                s = 'Rules: '+this._rule_index+' of '+(this._rules.length-1)+'  ';
            }                
            s = s + 'Total: '+this.options.recordset.length();
            this.span_info.html( s );
            this.span_info.show();
            
            if(isTerminated){
                this.div_progress.hide();
                return;
            }
            
            var curr_offset = Number(this._query_request.o);
            curr_offset = (curr_offset>0?curr_offset:0) + Number(this._query_request.l);
            var tot = this._total_count_of_curr_request;
            if(curr_offset>tot) curr_offset = tot;
            
            if(this._rule_index<1){  //this is main request
                    
                    //search in progress
                     this.lbl_current_request.html(curr_offset==tot?tot:curr_offset+'~'+tot);
                     
                     this.span_progress.progressbar( "value", curr_offset/tot*100 );
                     //this.span_progress.html( $('<div>').css({'background-color':'blue', 'width': curr_offset/tot*100+'%'}) );
                     this.div_progress.show();
            
                     if(curr_offset==tot) {
                           this.div_progress.delay(500).hide();
                     }
                     
            }else{ //this is rule request
            
                     if( this._rule_index < this._rules.length){
            
                        var res_steps_count = this._rules[this._rules[this._rule_index].parent].results.length;
                
                        this.lbl_current_request.html( (curr_offset==tot?tot:curr_offset+'~'+tot)+' of '+
                            (this._res_index+1)+'~'+res_steps_count);
                            
                        var progress_value = this._res_index/res_steps_count*100 + curr_offset/tot*100/res_steps_count
                            
                        this.span_progress.progressbar( "value", progress_value );
                            
                        this.div_progress.show();
                     }
                
            }
            
            /*var offset = this.options.recordset.offset();
            var len   = this.options.recordset.length();
            var total = this.options.recordset.count_total();
            if(total>0){
                this.span_info.show();
                this.span_info.html( (offset+1)+"-"+(offset+len)+"/"+total);
            }else{
                this.span_info.html('');
            }*/
        }else{
            this.span_info.hide();
            this.div_progress.hide();
        }


        
    },

    //@todo - do not apply rules unless main search is finished
    //@todo - if search in progress and new rules are applied - stop this search and remove all linked data (only main search remains)
    _doSearchIncrement: function(){

        if ( this._query_request ) {

            this._query_request.source = this.element.attr('id'); //orig = 'rec_list';
            
            
            var new_offset = Number(this._query_request.o);
            new_offset = (new_offset>0?new_offset:0) + Number(this._query_request.l);
            
            if(new_offset< this._total_count_of_curr_request){ //search for next chunk of data within current request
                    this._query_request.increment = true;
                    this._query_request.o = new_offset;
                    top.HAPI4.RecordMgr.search(this._query_request, $(this.document));
            }else{
                    
         // original rule array
         // rules:[ {query:query, levels:[]}, ....  ]           
         
         // we create flat array to allow smooth loop
         // rules:[ {query:query, results:[], parent:index},  ]

                      
                     // this._rule_index;  current rule
                     // this._res_index;   curent index in result array (from previous level)

                     var current_parent_ids;
                     var current_rule;
                     
                     while (true){ //while find rule with filled parent's resultset
                         
                         if(this._rule_index<1){  
                             this._rule_index = 1; //start with index 1 - since zero is main resultset
                             this._res_index = 0;
                         }else{
                             this._res_index++;  //goto next 1000 records
                         }
                     
                         if(this._rule_index>=this._rules.length){
                             this._rule_index = -1; //reset
                             this._res_index = -1;
                             this._renderProgress();
                             return false; //this is the end
                         }
                             
                         current_rule = this._rules[this._rule_index];
                         //results from parent level
                         current_parent_ids = this._rules[current_rule.parent].results
                     
                         //if we access the end of result set - got to next rule
                         if(this._res_index >= current_parent_ids.length)
                         {
                            this._res_index = -1; 
                            this._rule_index++;
                            
                         }else{
                            break; 
                         }
                     }
                     
                     
                     //create request 
                     this._query_request.q = current_rule.query;
                     this._query_request.topids = current_parent_ids[this._res_index].join(','); //list of record ids of parent resultset
                     this._query_request.increment = true;
                     this._query_request.o = 0;
                     top.HAPI4.RecordMgr.search(this._query_request, $(this.document));
                
            }
        }

        return false;
    }, 
    

});
