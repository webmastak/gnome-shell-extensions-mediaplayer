const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Tweener = imports.ui.tweener;
const BoxPointer = imports.ui.boxpointer;

const Gettext = imports.gettext.domain('gnome-shell-extensions-mediaplayer');
const _ = Gettext.gettext;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Widget = Me.imports.widget;
const DBusIface = Me.imports.dbus;
const Settings = Me.imports.settings;
const Player = Me.imports.player;


const COVER_SIZE = 64;


const PlayerUI = new Lang.Class({
  Name: 'PlayerUI',
  Extends: Player.PlayerMenu,

  _init: function(player) {
    this.parent(player.info.identity, true);
    this.player = player;
    this._updateId = player.connect("player-update", Lang.bind(this, this.update));
    this._updateInfoId = player.connect("player-info-update", Lang.bind(this, this.updateInfo));

    this.trackCoverContainer = new St.Button({style_class: 'track-cover-container',
                                              x_align: St.Align.START,
                                              y_align: St.Align.START});
    //this.trackCoverContainer.connect('clicked', Lang.bind(this, this._toggleCover));
    this.trackCoverFile = false;
    this.trackCoverFileTmp = false;
    this.trackCover = new St.Icon({icon_name: "media-optical-cd-audio", icon_size: COVER_SIZE});
    this.trackCoverContainer.set_child(this.trackCover);

    this.trackBox = new Widget.TrackBox(this.trackCoverContainer);
    this.addMenuItem(this.trackBox);

    this.prevButton = new Widget.PlayerButton('media-skip-backward-symbolic',
                                              Lang.bind(this.player, this.player.previous));
    this.playButton = new Widget.PlayerButton('media-playback-start-symbolic',
                                              Lang.bind(this.player, this.player.playPause));
    this.stopButton = new Widget.PlayerButton('media-playback-stop-symbolic',
                                              Lang.bind(this.player, this.player.stop));
    this.stopButton.hide();
    this.nextButton = new Widget.PlayerButton('media-skip-forward-symbolic',
                                              Lang.bind(this.player, this.player.next));

    this.trackControls = new Widget.PlayerButtons();
    this.trackControls.addButton(this.prevButton);
    this.trackControls.addButton(this.playButton);
    this.trackControls.addButton(this.stopButton);
    this.trackControls.addButton(this.nextButton);

    this.addMenuItem(this.trackControls);
  },

  update: function(player, newState) {

    global.log("#######################");
    global.log(JSON.stringify(newState));

    if (newState.trackTitle || newState.trackArtist || newState.trackAlbum) {
      this.trackBox.empty();
      if (player.state.trackTitle)
        this.trackBox.addInfo(new Widget.TrackTitle(null, player.state.trackTitle, 'track-title'));
      if (player.state.trackArtist)
        this.trackBox.addInfo(new Widget.TrackTitle(null, player.state.trackArtist, 'track-artist'));
      if (player.state.trackAlbum)
        this.trackBox.addInfo(new Widget.TrackTitle(null, player.state.trackAlbum, 'track-album'));
    }

    if ('trackCoverFile' in newState) {
      if (newState.trackCoverFile) {
        let cover_path = "";
        // Distant cover
        if (newState.trackCoverFile.match(/^http/)) {
          // hide current cover
          this._hideCover();
          // Copy the cover to a tmp local file
          let cover = Gio.file_new_for_uri(decodeURIComponent(newState.trackCoverFile));
          // Don't create multiple tmp files
          if (!this.trackCoverFileTmp)
            this.trackCoverFileTmp = Gio.file_new_tmp('XXXXXX.mediaplayer-cover')[0];
          // asynchronous copy
          cover.read_async(null, null, Lang.bind(this, this._onReadCover));
        }
        // Local cover
        else if (newState.trackCoverFile.match(/^file/)) {
          this.trackCoverPath = decodeURIComponent(newState.trackCoverFile.substr(7));
          this._showCover();
        }

      }
      else {
        this.trackCoverPath = false;
        this._showCover();
      }
    }

    if (newState.canPause !== null) {
      if (newState.canPause)
        this.playButton.setCallback(Lang.bind(this.player, this.player.playPause));
      else
        this.playButton.setCallback(Lang.bind(this.player, this.player.play));
    }

    if (newState.canGoNext !== null) {
      if (newState.canGoNext)
        this.nextButton.enable();
      else
        this.nextButton.disable();
    }

    if (newState.canGoPrevious !== null) {
      if (newState.canGoPrevious)
        this.prevButton.enable();
      else
        this.prevButton.disable();
    }

    if (newState.status) {
      let status = newState.status;
      this.status.text = _(status);

      if (status == Settings.Status.STOP)
        this.trackBox.hideAnimate();
      else {
        global.log("show Animate");
        this.trackBox.showAnimate();
      }

      if (status === Settings.Status.PLAY) {
        this.stopButton.show();
        this.playButton.setIcon('media-playback-pause-symbolic');
      }
      else if (status === Settings.Status.PAUSE) {
        this.playButton.setIcon('media-playback-start-symbolic');
      }
      else if (status == Settings.Status.STOP) {
        this.stopButton.hide();
        this.playButton.show();
        this.playButton.setIcon('media-playback-start-symbolic');
      }
    }

    global.log("#######################");
  },

  _onReadCover: function(cover, result) {
    let inStream = cover.read_finish(result);
    let outStream = this.trackCoverFileTmp.replace(null, false,
                                                   Gio.FileCreateFlags.REPLACE_DESTINATION,
                                                   null, null);
    outStream.splice_async(inStream, Gio.OutputStreamSpliceFlags.CLOSE_TARGET,
                           0, null, Lang.bind(this, this._onSavedCover));
  },

  _onSavedCover: function(outStream, result) {
    outStream.splice_finish(result, null);
    this.trackCoverPath = this.trackCoverFileTmp.get_path();
    this._showCover();
  },

  _hideCover: function() {
    Tweener.addTween(this.trackCoverContainer, {
      opacity: 0,
      time: 0.3,
      transition: 'easeOutCubic',
    });
  },

  _showCover: function() {
    Tweener.addTween(this.trackCoverContainer, {
      opacity: 0,
      time: 0.3,
      transition: 'easeOutCubic',
      onComplete: Lang.bind(this, function() {
        // Change cover
        if (! this.trackCoverPath || ! GLib.file_test(this.trackCoverPath, GLib.FileTest.EXISTS)) {
          this.trackCover = new St.Icon({icon_name: "media-optical-cd-audio", icon_size: COVER_SIZE});
        }
        else {
          this.trackCover = new St.Bin({style_class: 'track-cover'});
          let coverTexture = new Clutter.Texture({filter_quality: 2, filename: this.trackCoverPath});
          let [coverWidth, coverHeight] = coverTexture.get_base_size();
          this.trackCover.width = COVER_SIZE;
          this.trackCover.height = coverHeight / (coverWidth / COVER_SIZE);
          this.trackCover.set_child(coverTexture);
        }
        this.trackCoverContainer.set_child(this.trackCover);
        // Show the new cover
        Tweener.addTween(this.trackCoverContainer, {
          opacity: 255,
          time: 0.3,
          transition: 'easeInCubic',
        });
      })
    });
  },

  updateInfo: function(player) {
    this.icon.gicon = player.info.appInfo.get_icon();
    this.label.text = player.info.identity;
  },

  destroy: function() {
    if (this.updatesId) {
      this.player.disconnectSignal(this._updateId);
      this.player.disconnectSignal(this._updateInfoId);
    }
    this.parent();
  }

});

