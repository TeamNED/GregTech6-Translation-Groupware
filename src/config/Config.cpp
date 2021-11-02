#include "Config.hpp"

Config::Config(string lang) : _lang(lang) {}

const string &Config::lang() const { return this->_lang; }
const string &Config::version() const { return this->_version; }
const vector<shared_ptr<Generator>> &Config::generators() const {
  return this->_generators;
}
